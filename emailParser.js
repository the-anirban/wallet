function extractTextFromHTML(htmlString) {
  htmlString = htmlString.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  htmlString = htmlString.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  htmlString = htmlString.replace(/<[^>]+>/g, ' ');
  return htmlString.replace(/\s+/g, ' ').trim();
}

function extractEmailData(body) {
  body = extractTextFromHTML(body);
  body = body.slice(0, -129); // Adjust depending on format

  var paidAmountRegex = /paid\s+₹([\d.]+)/i;
  var receivedAmountRegex = /received\s+₹([\d.]+)/i;
  var recipientRegex = /to\s+([A-Za-z\s]+)(?=\s*Transaction ID|Date|₹|$)/i;
  var senderRegex = /from\s+([A-Za-z\s]+)(?=\s*Transaction ID|Date|₹|$)/i;
  var timeDateRegex = /(\d{1,2}:\d{2}\s*[AP]M)\s*IST,\s*(\d+\s+\w+\s+\d{4})/i;
  var transactionIdRegex = /transaction\s*id\s*[:\s]+(\w+)/i;
  var balanceRegex = /Balance\s*[:]\s*₹([\d.]+)/i;

  var paidAmountMatch = body.match(paidAmountRegex);
  var receivedAmountMatch = body.match(receivedAmountRegex);
  var amount = paidAmountMatch ? paidAmountMatch[1] : (receivedAmountMatch ? receivedAmountMatch[1] : 'N/A');
  var recipientMatch = body.match(recipientRegex);
  var senderMatch = body.match(senderRegex);
  var timeDateMatch = body.match(timeDateRegex);
  var transactionIdMatch = body.match(transactionIdRegex);
  var balanceMatch = body.match(balanceRegex);

  return {
    recipient: recipientMatch ? recipientMatch[1] : 'N/A',
    senderName: senderMatch ? senderMatch[1] : 'N/A',
    time: timeDateMatch ? timeDateMatch[1] : 'N/A',
    date: timeDateMatch ? timeDateMatch[2] : 'N/A',
    transactionId: transactionIdMatch ? transactionIdMatch[1] : 'N/A',
    balance: balanceMatch ? balanceMatch[1] : 'N/A',
    amount: amount
  };
}
