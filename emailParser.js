/*
  emailParser_for_GAS.js
  Google Apps Script compatible email extractor.

  Usage (from GAS):

  var parserCode = UrlFetchApp.fetch(
    "https://raw.githubusercontent.com/the-anirban/wallet/refs/heads/main/emailParser.js"
  ).getContentText();
  eval(parserCode);

  // After eval you can call:
  var result = extractEmailData(htmlString);

  Returned object:
  {
    recipient, senderName, accountHolder, time, date, transactionId,
    balance, amount, amountNumber, balanceNumber,
    _meta: { method, confidence, diagnostics }
  }

  Notes:
  - Uses pure string/regex parsing (no DOMParser) so it runs in GAS server-side.
  - Tries to extract table label/value pairs (Transaction ID, Date, Updated Balance).
  - Fallback heuristics search the full plain-text for common phrases.
*/

(function(global) {
  'use strict';

  function sanitizeHTML(html) {
    if (!html) return '';
    // remove script/style blocks first
    return String(html)
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  }

  function htmlToPlainText(html) {
    if (!html) return '';
    var s = String(html);
    // Replace tags with spaces so words don't join
    s = s.replace(/<br\s*\/?>/gi, '\\n');
    s = s.replace(/<[^>]+>/g, ' ');
    // decode basic HTML entities
    s = s.replace(/&nbsp;/gi, ' ')
         .replace(/&amp;/gi, '&')
         .replace(/&lt;/gi, '<')
         .replace(/&gt;/gi, '>')
         .replace(/&quot;/gi, '"')
         .replace(/&#39;/g, "'");
    // collapse spaces
    s = s.replace(/\s+/g, ' ').trim();
    return s;
  }

  function parseAmountToken(token) {
    if (!token) return null;
    var t = String(token).replace(/[\s,]/g, '');
    // remove currency symbols and stray letters
    t = t.replace(/[^0-9.\-]/g, '');
    if (!t) return null;
    var num = parseFloat(t);
    return isFinite(num) ? num : null;
  }

  function findLabelValuePairsFromTables(html) {
    // naive table row parser - works on common email table markup
    var pairs = {};
    try {
      var trRe = /<tr[\s\S]*?>[\s\S]*?<\/tr>/gi;
      var tdRe = /<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi;
      var trs = html.match(trRe) || [];
      for (var i = 0; i < trs.length; i++) {
        var tr = trs[i];
        var tds = tr.match(tdRe) || [];
        var texts = tds.map(function(td) {
          return htmlToPlainText(td).trim();
        }).filter(function(t){return t;});
        if (texts.length >= 2) {
          // left is label, right is value
          var label = texts[0].replace(/[:\s]+$/,'').toLowerCase();
          var value = texts.slice(1).join(' ').trim();
          pairs[label] = value;
        }
      }
    } catch (e) {
      // ignore
    }
    return pairs;
  }

  function extractWithRegex(text) {
    var body = text || '';

    var patterns = {
      received: /received\s+₹?\s*([0-9,\.]+)/i,
      paid: /paid\s+₹?\s*([0-9,\.]+)/i,
      rupee: /₹\s*([0-9,\.]+)/g,
      from: /\bfrom\s+([A-Za-z.\s&'`-]{2,80})/i,
      to: /\bto\s+([A-Za-z.\s&'`-]{2,80})/i,
      hey: /hey\s+([A-Za-z.\s&'`-]{2,80}),/i,
      timeDate: /(\d{1,2}:\d{2}\s*[AP]M)\s*(?:IST|UTC|GMT)?\s*,?\s*(\d{1,2}\s+\w+\s+\d{4})/i,
      transactionId: /transaction\s*id\s*[:\-\s]*([A-Z0-9\-]+)/i,
      balance1: /updated\s+balance\s*[:\s]*₹?\s*([0-9,\.]+)/i,
      balance2: /balance\s+is\s*[:\s]*₹?\s*([0-9,\.]+)/i
    };

    var result = {};

    var m;
    if ((m = body.match(patterns.received))) result.amount = m[1];
    else if ((m = body.match(patterns.paid))) result.amount = m[1];
    else {
      var ru = body.match(patterns.rupee);
      if (ru && ru.length) {
        result.amount = (ru[0].match(/[0-9,\.]+/)||[])[0];
      }
    }

    if ((m = body.match(patterns.from))) result.senderName = m[1].trim();
    if ((m = body.match(patterns.to))) result.recipient = m[1].trim();
    if ((m = body.match(patterns.hey))) result.accountHolder = m[1].trim();
    if ((m = body.match(patterns.timeDate))) {
      result.time = m[1].trim();
      result.date = m[2].trim();
    }
    if ((m = body.match(patterns.transactionId))) result.transactionId = m[1].trim();
    if ((m = body.match(patterns.balance1))) result.balance = m[1].trim();
    else if ((m = body.match(patterns.balance2))) result.balance = m[1].trim();

    return result;
  }

  function confidenceScore(found) {
    // crude scoring
    var score = 0;
    if (found.amount) score += 0.4;
    if (found.transactionId) score += 0.25;
    if (found.senderName || found.recipient) score += 0.2;
    if (found.balance || found.date) score += 0.15;
    if (score > 1) score = 1;
    return Math.round(score * 100)/100;
  }

  // Exported function for GAS
  function extractEmailData(htmlString) {
    var sanitized = sanitizeHTML(htmlString || '');
    var tablePairs = findLabelValuePairsFromTables(sanitized);

    var plain = htmlToPlainText(sanitized);

    // First, try to assemble from table pairs (preferred if present)
    var extraction = {
      recipient: 'N/A',
      senderName: 'N/A',
      accountHolder: 'N/A',
      time: 'N/A',
      date: 'N/A',
      transactionId: 'N/A',
      balance: 'N/A',
      amount: 'N/A'
    };

    // Map common table labels to fields
    for (var key in tablePairs) {
      if (!tablePairs.hasOwnProperty(key)) continue;
      var v = tablePairs[key];
      if (/transaction id/i.test(key) || /transactionid/i.test(key)) extraction.transactionId = v;
      else if (/date/i.test(key)) {
        // try parse time & date
        var td = v.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*(?:IST|UTC|GMT)?\s*,?\s*(\d{1,2}\s+\w+\s+\d{4})/i);
        if (td) { extraction.time = td[1]; extraction.date = td[2]; }
        else extraction.date = v;
      }
      else if (/updated balance|balance/i.test(key)) {
        extraction.balance = (v.match(/₹?\s*([0-9,\.]+)/) || [null,null])[1] || v;
      }
    }

    // Next, heuristic regex on plain text
    var regexFound = extractWithRegex(plain);

    // Merge results: prefer table values, else regex
    function pick(field) {
      if (extraction[field] && extraction[field] !== 'N/A') return extraction[field];
      if (regexFound[field]) return regexFound[field];
      return 'N/A';
    }

    var final = {
      recipient: pick('recipient'),
      senderName: pick('senderName'),
      accountHolder: pick('accountHolder'),
      time: pick('time'),
      date: pick('date'),
      transactionId: pick('transactionId'),
      balance: pick('balance'),
      amount: pick('amount')
    };

    // normalization: if recipient still N/A, try to find "to <bold>NAME</bold>" style by scanning raw HTML for "to <span...>NAME</span>"
    if ((final.recipient === 'N/A' || final.recipient === null) && /\bto\b/i.test(plain)) {
      // try HTML capture: look for to <span class=...>NAME</span>
      var m = sanitized.match(/to\s*<[^>]*>([^<]{2,80})<\//i);
      if (m && m[1]) final.recipient = m[1].trim();
    }

    // Final numeric conversions
    var amountNumber = parseAmountToken(final.amount);
    var balanceNumber = parseAmountToken(final.balance);

    // As a last resort: if amount still N/A but document title contains money, try title
    if ((!final.amount || final.amount === 'N/A') && /₹\s*[0-9,\.]+/.test(htmlString)) {
      var tt = htmlString.match(/₹\s*([0-9,\.]+)/);
      if (tt) final.amount = tt[1];
      amountNumber = parseAmountToken(final.amount);
    }

    // Confidence
    var conf = confidenceScore(final);

    return {
      recipient: final.recipient || 'N/A',
      senderName: final.senderName || 'N/A',
      accountHolder: final.accountHolder || 'N/A',
      time: final.time || 'N/A',
      date: final.date || 'N/A',
      transactionId: final.transactionId || 'N/A',
      balance: final.balance || 'N/A',
      amount: final.amount || 'N/A',
      amountNumber: amountNumber === null ? 'N/A' : amountNumber,
      balanceNumber: balanceNumber === null ? 'N/A' : balanceNumber,
      _meta: {
        method: 'regex-gas',
        confidence: conf,
        diagnostics: {
          tablePairs: tablePairs,
          plainSnippet: plain.slice(0, 800)
        }
      }
    };
  }

  // Expose to global scope (so eval(parserCode) will make it available)
  global.extractEmailData = extractEmailData;
  global.extractTextFromHTML = htmlToPlainText;

})(this);
