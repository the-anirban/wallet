function extractTextFromHTML(htmlString) {
htmlString = htmlString.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
htmlString = htmlString.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
htmlString = htmlString.replace(/<[^>]+>/g, ' ');
return htmlString.replace(/\s+/g, ' ').trim();
}

function extractEmailData(body) {
  body = extractTextFromHTML(body);

  // Regex patterns
  var paidAmountRegex = /paid\s+₹([\d.]+)/i;
  var receivedAmountRegex = /received\s+₹([\d.]+)/i;
  var recipientRegex = /to\s+([A-Za-z\s.&]+?)\s+at/i;
  var receivedSenderRegex = /from\s+([A-Za-z\s.&]+?)\s+at/i; // <-- NEW for received
  var accountHolderRegex = /Hey\s+([A-Za-z\s.&]+),/i;        // the "Hey ..." line
  var timeDateRegex = /at\s+(\d{1,2}:\d{2}\s*[AP]M)\s*IST,\s*(\d+\s+\w+\s+\d{4})/i;
  var transactionIdRegex = /transaction id\s+(\w+)/i;
  var balanceRegex = /balance is\s+₹([\d.]+)/i;
  var balanceRegexAlt = /updated balance is\s+₹([\d.]+)/i;

  // Matches
  var paidAmountMatch = body.match(paidAmountRegex);
  var receivedAmountMatch = body.match(receivedAmountRegex);
  var amount = paidAmountMatch ? paidAmountMatch[1] : (receivedAmountMatch ? receivedAmountMatch[1] : 'N/A');

  var recipientMatch = body.match(recipientRegex);
  var receivedSenderMatch = body.match(receivedSenderRegex);
  var accountHolderMatch = body.match(accountHolderRegex);
  var timeDateMatch = body.match(timeDateRegex);
  var transactionIdMatch = body.match(transactionIdRegex);
  var balanceMatch = body.match(balanceRegex) || body.match(balanceRegexAlt);

  // Decide who goes in the "Sender" column:
  // - If it's a received payment → sender = the one after "from"
  // - If it's a paid transaction → sender = N/A (we'll use recipient column instead)
  var senderName = receivedSenderMatch ? receivedSenderMatch[1].trim() : "N/A";

  return {
    recipient: recipientMatch ? recipientMatch[1].trim() : "N/A",
    senderName: senderName,
    time: timeDateMatch ? timeDateMatch[1] : "N/A",
    date: timeDateMatch ? timeDateMatch[2] : "N/A",
    transactionId: transactionIdMatch ? transactionIdMatch[1] : "N/A",
    balance: balanceMatch ? balanceMatch[1] : "N/A",
    amount: amount
  };
}
