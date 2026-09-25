var crypto = require('crypto');

exports.pemToCert = function(pem) {
  var cert = /-----BEGIN CERTIFICATE-----([^-]*)-----END CERTIFICATE-----/g.exec(pem.toString());
  if (cert && cert.length > 0) {
    return cert[1].replace(/[\n|\r\n]/g, '');
  }

  return null;
};

exports.reportError = function(err, callback){
  if (callback){
    setImmediate(function(){
      callback(err);
    });
  }
};

/**
 * Return a unique identifier with the given `len`.
 *
 *     utils.uid(10);
 *     // => "FDaS435D2z"
 *
 * @param {Number} len
 * @return {String}
 * @api private
 */
exports.uid = function(len) {
  var buf = []
    , chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    , charlen = chars.length
    , maxValid = charlen * Math.floor(256 / charlen); // reject values that would bias the modulo

  while (buf.length < len) {
    var bytes = crypto.randomBytes(len - buf.length);
    for (var i = 0; i < bytes.length && buf.length < len; ++i) {
      if (bytes[i] < maxValid) {
        buf.push(chars[bytes[i] % charlen]);
      }
    }
  }

  return buf.join('');
};

exports.removeWhitespace = function(xml) {
  var trimmed = xml
                .replace(/\r\n/g, '')
                .replace(/\n/g,'')
                .replace(/>(\s*)</g, '><') //unindent
                .trim();
  return trimmed;
};
