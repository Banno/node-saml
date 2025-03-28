var assert = require('assert'),
    fs = require('fs'),
    utils = require('./utils'),
    moment = require('moment'),
    should = require('should'),
    xmldom = require('@xmldom/xmldom'),
    xmlenc = require('xml-encryption'),
    saml = require('../lib/saml20');

describe('saml 2.0', function () {

  it('whole thing with default authnContextClassRef', function () {
    var options = {
      cert: fs.readFileSync(__dirname + '/test-auth0.pem'),
      key: fs.readFileSync(__dirname + '/test-auth0.key'),
      issuer: 'urn:issuer',
      lifetimeInSeconds: 600,
      audiences: 'urn:myapp',
      attributes: {
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'foo@bar.com',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Foo Bar'
      },
      nameIdentifier:       'foo',
      nameIdentifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified'
    };

    var signedAssertion = saml.create(options);
    var isValid = utils.isValidSignature(signedAssertion, options.cert);
    assert.equal(true, isValid);

    
    var nameIdentifier = utils.getNameID(signedAssertion);
    assert.equal('foo', nameIdentifier.textContent);
    assert.equal('urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified', nameIdentifier.getAttribute('Format'));

    var attributes = utils.getAttributes(signedAssertion);
    assert.equal(2, attributes.length);
    assert.equal('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', attributes[0].getAttribute('Name'));
    assert.equal('foo@bar.com', attributes[0].textContent);
    assert.equal('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name', attributes[1].getAttribute('Name'));
    assert.equal('Foo Bar', attributes[1].textContent);

    assert.equal('urn:issuer', utils.getSaml2Issuer(signedAssertion).textContent);

    var conditions = utils.getConditions(signedAssertion);
    assert.equal(1, conditions.length);
    var notBefore = conditions[0].getAttribute('NotBefore');
    var notOnOrAfter = conditions[0].getAttribute('NotOnOrAfter');
    should.ok(notBefore);
    should.ok(notOnOrAfter);

    var lifetime = Math.round((moment(notOnOrAfter).utc() - moment(notBefore).utc()) / 1000);
    assert.equal(600, lifetime);

    var authnContextClassRef = utils.getAuthnContextClassRef(signedAssertion);
    assert.equal('urn:oasis:names:tc:SAML:2.0:ac:classes:unspecified', authnContextClassRef.textContent);
  });

  it('should set attributes', function () {
    var options = {
      cert: fs.readFileSync(__dirname + '/test-auth0.pem'),
      key: fs.readFileSync(__dirname + '/test-auth0.key'),
      attributes: {
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'foo@bar.com',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Foo Bar',
        'http://example.org/claims/testemptyarray': [], // should dont include empty arrays
        'http://example.org/claims/testaccent': 'fóo', // should supports accents
        'http://undefinedattribute/ws/com.com': undefined
      }
    };

    var signedAssertion = saml.create(options);
    
    var isValid = utils.isValidSignature(signedAssertion, options.cert);
    assert.equal(true, isValid);

    var attributes = utils.getAttributes(signedAssertion);
    assert.equal(3, attributes.length);
    assert.equal('saml:AttributeStatement', attributes[0].parentNode.nodeName);
    assert.equal('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', attributes[0].getAttribute('Name'));
    assert.equal('foo@bar.com', attributes[0].textContent);
    assert.equal('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name', attributes[1].getAttribute('Name'));
    assert.equal('Foo Bar', attributes[1].textContent);
    assert.equal('http://example.org/claims/testaccent', attributes[2].getAttribute('Name'));
    assert.equal('fóo', attributes[2].textContent);
  });

  it('should set attributes with the correct attribute type', function () {
    var options = {
      cert: fs.readFileSync(__dirname + '/test-auth0.pem'),
      key: fs.readFileSync(__dirname + '/test-auth0.key'),
      attributes: {
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'foo@bar.com',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Foo Bar',
        'http://example.org/claims/testemptyarray': [], // should dont include empty arrays
        'http://example.org/claims/testaccent': 'fóo', // should supports accents
        'http://attributes/boolean': true, 
        'http://attributes/booleanNegative': false, 
        'http://attributes/number': 123, 
        'http://undefinedattribute/ws/com.com': undefined
      }
    };

    var signedAssertion = saml.create(options);
    
    var isValid = utils.isValidSignature(signedAssertion, options.cert);
    assert.equal(true, isValid);

    var attributes = utils.getAttributes(signedAssertion);
    assert.equal(6, attributes.length);
    assert.equal('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', attributes[0].getAttribute('Name'));
    assert.equal('foo@bar.com', attributes[0].textContent);
    assert.equal('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name', attributes[1].getAttribute('Name'));
    assert.equal('Foo Bar', attributes[1].textContent);
    assert.equal('http://example.org/claims/testaccent', attributes[2].getAttribute('Name'));
    assert.equal('xs:string', attributes[2].firstChild.getAttribute('xsi:type'));
    assert.equal('fóo', attributes[2].textContent);
    assert.equal('http://attributes/boolean', attributes[3].getAttribute('Name'));
    assert.equal('xs:boolean', attributes[3].firstChild.getAttribute('xsi:type'));
    assert.equal('true', attributes[3].textContent);
    assert.equal('http://attributes/booleanNegative', attributes[4].getAttribute('Name'));
    assert.equal('xs:boolean', attributes[4].firstChild.getAttribute('xsi:type'));
    assert.equal('false', attributes[4].textContent);
    assert.equal('http://attributes/number', attributes[5].getAttribute('Name'));
    assert.equal('xs:double', attributes[5].firstChild.getAttribute('xsi:type'));
    assert.equal('123', attributes[5].textContent);
  });

  it('should set attributes with the correct attribute type and NameFormat', function () {
    var options = {
      cert: fs.readFileSync(__dirname + '/test-auth0.pem'),
      key: fs.readFileSync(__dirname + '/test-auth0.key'),
      attributes: {
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'foo@bar.com',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Foo Bar',
        'http://example.org/claims/testemptyarray': [], // should dont include empty arrays
        'testaccent': 'fóo', // should supports accents
        'urn:test:1:2:3': true,
        '123~oo': 123, 
        'http://undefinedattribute/ws/com.com': undefined
      }
    };

    var signedAssertion = saml.create(options);
    
    var isValid = utils.isValidSignature(signedAssertion, options.cert);
    assert.equal(true, isValid);

    var attributes = utils.getAttributes(signedAssertion);
    assert.equal(5, attributes.length);
    assert.equal('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', attributes[0].getAttribute('Name'));
    assert.equal('urn:oasis:names:tc:SAML:2.0:attrname-format:uri', attributes[0].getAttribute('NameFormat'));    
    assert.equal('foo@bar.com', attributes[0].textContent);
    assert.equal('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name', attributes[1].getAttribute('Name'));
    assert.equal('urn:oasis:names:tc:SAML:2.0:attrname-format:uri', attributes[1].getAttribute('NameFormat'));    
    assert.equal('Foo Bar', attributes[1].textContent);
    assert.equal('testaccent', attributes[2].getAttribute('Name'));
    assert.equal('urn:oasis:names:tc:SAML:2.0:attrname-format:basic', attributes[2].getAttribute('NameFormat'));    
    assert.equal('xs:string', attributes[2].firstChild.getAttribute('xsi:type'));
    assert.equal('fóo', attributes[2].textContent);
    assert.equal('urn:test:1:2:3', attributes[3].getAttribute('Name'));
    assert.equal('urn:oasis:names:tc:SAML:2.0:attrname-format:uri', attributes[3].getAttribute('NameFormat'));
    assert.equal('xs:boolean', attributes[3].firstChild.getAttribute('xsi:type'));
    assert.equal('true', attributes[3].textContent);
    assert.equal('123~oo', attributes[4].getAttribute('Name'));
    assert.equal('urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified', attributes[4].getAttribute('NameFormat'));    
    assert.equal('xs:double', attributes[4].firstChild.getAttribute('xsi:type'));
    assert.equal('123', attributes[4].textContent);
  });

  it('should set attributes to anytpe when typedAttributes is false', function () {
    var options = {
      cert: fs.readFileSync(__dirname + '/test-auth0.pem'),
      key: fs.readFileSync(__dirname + '/test-auth0.key'),
      typedAttributes: false,
      attributes: {
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'foo@bar.com',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Foo Bar',
        'http://example.org/claims/testemptyarray': [], // should dont include empty arrays
        'http://example.org/claims/testaccent': 'fóo', // should supports accents
        'http://attributes/boolean': true, 
        'http://attributes/number': 123, 
        'http://undefinedattribute/ws/com.com': undefined
      }
    };

    var signedAssertion = saml.create(options);
    
    var isValid = utils.isValidSignature(signedAssertion, options.cert);
    assert.equal(true, isValid);

    var attributes = utils.getAttributes(signedAssertion);
    assert.equal(5, attributes.length);
    assert.equal('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', attributes[0].getAttribute('Name'));
    assert.equal('foo@bar.com', attributes[0].textContent);
    assert.equal('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name', attributes[1].getAttribute('Name'));
    assert.equal('Foo Bar', attributes[1].textContent);
    assert.equal('http://example.org/claims/testaccent', attributes[2].getAttribute('Name'));
    assert.equal('xs:anyType', attributes[2].firstChild.getAttribute('xsi:type'));
    assert.equal('fóo', attributes[2].textContent);
    assert.equal('http://attributes/boolean', attributes[3].getAttribute('Name'));
    assert.equal('xs:anyType', attributes[3].firstChild.getAttribute('xsi:type'));
    assert.equal('true', attributes[3].textContent);
    assert.equal('http://attributes/number', attributes[4].getAttribute('Name'));
    assert.equal('xs:anyType', attributes[4].firstChild.getAttribute('xsi:type'));
    assert.equal('123', attributes[4].textContent);
  });

  it('should not set NameFormat in attributes when includeAttributeNameFormat is false', function () {
    var options = {
      cert: fs.readFileSync(__dirname + '/test-auth0.pem'),
      key: fs.readFileSync(__dirname + '/test-auth0.key'),
      typedAttributes: false,
      includeAttributeNameFormat: false,
      attributes: {
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'foo@bar.com',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Foo Bar',
        'http://example.org/claims/testemptyarray': [], // should dont include empty arrays
        'testaccent': 'fóo', // should supports accents
        'urn:test:1:2:3': true,
        '123~oo': 123, 
        'http://undefinedattribute/ws/com.com': undefined
      }
    };

    var signedAssertion = saml.create(options);
    
    var isValid = utils.isValidSignature(signedAssertion, options.cert);
    assert.equal(true, isValid);

    var attributes = utils.getAttributes(signedAssertion);
    assert.equal(5, attributes.length);
    assert.equal('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', attributes[0].getAttribute('Name'));
    assert.equal('', attributes[0].getAttribute('NameFormat'));    
    assert.equal('foo@bar.com', attributes[0].textContent);
    assert.equal('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name', attributes[1].getAttribute('Name'));
    assert.equal('', attributes[1].getAttribute('NameFormat'));    
    assert.equal('Foo Bar', attributes[1].textContent);
    assert.equal('testaccent', attributes[2].getAttribute('Name'));
    assert.equal('', attributes[2].getAttribute('NameFormat'));    
    assert.equal('fóo', attributes[2].textContent);
    assert.equal('urn:test:1:2:3', attributes[3].getAttribute('Name'));
    assert.equal('', attributes[3].getAttribute('NameFormat'));
    assert.equal('true', attributes[3].textContent);
    assert.equal('123~oo', attributes[4].getAttribute('Name'));
    assert.equal('', attributes[4].getAttribute('NameFormat'));    
    assert.equal('123', attributes[4].textContent);
  });

  it('should ignore undefined attributes in array', function () {
    var options = {
      cert: fs.readFileSync(__dirname + '/test-auth0.pem'),
      key: fs.readFileSync(__dirname + '/test-auth0.key'),
      attributes: {
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'foo@bar.com',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Foo Bar',
        'http://example.org/claims/testemptyarray': [], // should dont include empty arrays
        'arrayAttribute': [ 'foo', undefined, 'bar'],
        'urn:test:1:2:3': true,
        '123~oo': 123, 
        'http://undefinedattribute/ws/com.com': undefined
      }
    };

    var signedAssertion = saml.create(options);
    
    var isValid = utils.isValidSignature(signedAssertion, options.cert);
    assert.equal(true, isValid);

    var attributes = utils.getAttributes(signedAssertion);
    assert.equal(5, attributes.length);
    assert.equal('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', attributes[0].getAttribute('Name'));
    assert.equal('urn:oasis:names:tc:SAML:2.0:attrname-format:uri', attributes[0].getAttribute('NameFormat'));    
    assert.equal('foo@bar.com', attributes[0].textContent);
    assert.equal('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name', attributes[1].getAttribute('Name'));
    assert.equal('urn:oasis:names:tc:SAML:2.0:attrname-format:uri', attributes[1].getAttribute('NameFormat'));    
    assert.equal('Foo Bar', attributes[1].textContent);
    assert.equal('arrayAttribute', attributes[2].getAttribute('Name'));
    assert.equal('urn:oasis:names:tc:SAML:2.0:attrname-format:basic', attributes[2].getAttribute('NameFormat'));    
    assert.equal('xs:string', attributes[2].firstChild.getAttribute('xsi:type'));
    assert.equal(2, attributes[2].childNodes.length);
    assert.equal('foo', attributes[2].childNodes[0].textContent);
    // undefined should not be here
    assert.equal('bar', attributes[2].childNodes[1].textContent);
    assert.equal('urn:test:1:2:3', attributes[3].getAttribute('Name'));
    assert.equal('urn:oasis:names:tc:SAML:2.0:attrname-format:uri', attributes[3].getAttribute('NameFormat'));
    assert.equal('xs:boolean', attributes[3].firstChild.getAttribute('xsi:type'));
    assert.equal('true', attributes[3].textContent);
    assert.equal('123~oo', attributes[4].getAttribute('Name'));
    assert.equal('urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified', attributes[4].getAttribute('NameFormat'));    
    assert.equal('xs:double', attributes[4].firstChild.getAttribute('xsi:type'));
    assert.equal('123', attributes[4].textContent);
  });

  it('whole thing with specific authnContextClassRef', function () {
    var options = {
      cert: fs.readFileSync(__dirname + '/test-auth0.pem'),
      key: fs.readFileSync(__dirname + '/test-auth0.key'),
      issuer: 'urn:issuer',
      lifetimeInSeconds: 600,
      audiences: 'urn:myapp',
      attributes: {
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'foo@bar.com',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Foo Bar'
      },
      nameIdentifier:       'foo',
      nameIdentifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified',
      authnContextClassRef: 'specific'
    };

    var signedAssertion = saml.create(options);
    var isValid = utils.isValidSignature(signedAssertion, options.cert);
    assert.equal(true, isValid);

    
    var nameIdentifier = utils.getNameID(signedAssertion);
    assert.equal('foo', nameIdentifier.textContent);
    assert.equal('urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified', nameIdentifier.getAttribute('Format'));

    var attributes = utils.getAttributes(signedAssertion);
    assert.equal(2, attributes.length);
    assert.equal('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', attributes[0].getAttribute('Name'));
    assert.equal('foo@bar.com', attributes[0].textContent);
    assert.equal('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name', attributes[1].getAttribute('Name'));
    assert.equal('Foo Bar', attributes[1].textContent);

    assert.equal('urn:issuer', utils.getSaml2Issuer(signedAssertion).textContent);

    var conditions = utils.getConditions(signedAssertion);
    assert.equal(1, conditions.length);
    var notBefore = conditions[0].getAttribute('NotBefore');
    var notOnOrAfter = conditions[0].getAttribute('NotOnOrAfter');
    should.ok(notBefore);
    should.ok(notOnOrAfter);

    var lifetime = Math.round((moment(notOnOrAfter).utc() - moment(notBefore).utc()) / 1000);
    assert.equal(600, lifetime);

    var authnContextClassRef = utils.getAuthnContextClassRef(signedAssertion);
    assert.equal('specific', authnContextClassRef.textContent);
  });

  it('should place signature where specified', function () {
     var options = {
      cert: fs.readFileSync(__dirname + '/test-auth0.pem'),
      key: fs.readFileSync(__dirname + '/test-auth0.key'),
      xpathToNodeBeforeSignature: "//*[local-name(.)='Conditions']",
      attributes: {
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'foo@bar.com',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Foo Bar',
        'http://example.org/claims/testemptyarray': [], // should dont include empty arrays
        'http://example.org/claims/testaccent': 'fóo', // should supports accents
        'http://undefinedattribute/ws/com.com': undefined
      }
    };

    var signedAssertion = saml.create(options);
    
    var isValid = utils.isValidSignature(signedAssertion, options.cert);
    assert.equal(true, isValid);
    
    var doc = new xmldom.DOMParser().parseFromString(signedAssertion);
    var signature = doc.documentElement.getElementsByTagName('Signature');

    assert.equal('saml:Conditions', signature[0].previousSibling.nodeName);
  });

  it('should place signature with prefix where specified', function () {
     var options = {
      cert: fs.readFileSync(__dirname + '/test-auth0.pem'),
      key: fs.readFileSync(__dirname + '/test-auth0.key'),
      xpathToNodeBeforeSignature: "//*[local-name(.)='Conditions']",
      signatureNamespacePrefix: 'anyprefix',
      attributes: {
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'foo@bar.com',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Foo Bar',
        'http://example.org/claims/testemptyarray': [], // should dont include empty arrays
        'http://example.org/claims/testaccent': 'fóo', // should supports accents
        'http://undefinedattribute/ws/com.com': undefined
      }
    };

    var signedAssertion = saml.create(options);
    
    var isValid = utils.isValidSignature(signedAssertion, options.cert);
    assert.equal(true, isValid);
    
    var doc = new xmldom.DOMParser().parseFromString(signedAssertion);
    var signature = doc.documentElement.getElementsByTagName(options.signatureNamespacePrefix + ':Signature');
    assert.equal('saml:Conditions', signature[0].previousSibling.nodeName);
  });

  it('should place signature with prefix where specified (backwards compat)', function () {
     var options = {
      cert: fs.readFileSync(__dirname + '/test-auth0.pem'),
      key: fs.readFileSync(__dirname + '/test-auth0.key'),
      xpathToNodeBeforeSignature: "//*[local-name(.)='Conditions']",
      prefix: 'anyprefix',
      attributes: {
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'foo@bar.com',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Foo Bar',
        'http://example.org/claims/testemptyarray': [], // should dont include empty arrays
        'http://example.org/claims/testaccent': 'fóo', // should supports accents
        'http://undefinedattribute/ws/com.com': undefined
      }
    };

    var signedAssertion = saml.create(options);
    
    var isValid = utils.isValidSignature(signedAssertion, options.cert);
    assert.equal(true, isValid);
    
    var doc = new xmldom.DOMParser().parseFromString(signedAssertion);
    var signature = doc.documentElement.getElementsByTagName(options.signatureNamespacePrefix + ':Signature');
    assert.equal('saml:Conditions', signature[0].previousSibling.nodeName);
  });

  it('should ignore prefix if not a string', function () {
     var options = {
      cert: fs.readFileSync(__dirname + '/test-auth0.pem'),
      key: fs.readFileSync(__dirname + '/test-auth0.key'),
      xpathToNodeBeforeSignature: "//*[local-name(.)='Conditions']",
      signatureNamespacePrefix: 123,
      attributes: {
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'foo@bar.com',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Foo Bar',
        'http://example.org/claims/testemptyarray': [], // should dont include empty arrays
        'http://example.org/claims/testaccent': 'fóo', // should supports accents
        'http://undefinedattribute/ws/com.com': undefined
      }
    };

    var signedAssertion = saml.create(options);
    
    var isValid = utils.isValidSignature(signedAssertion, options.cert);
    assert.equal(true, isValid);
    
    var doc = new xmldom.DOMParser().parseFromString(signedAssertion);
    var signature = doc.documentElement.getElementsByTagName('Signature');
    assert.equal('saml:Conditions', signature[0].previousSibling.nodeName);
  });


  it('should not include AudienceRestriction when there are no audiences', function () {
     var options = {
      cert: fs.readFileSync(__dirname + '/test-auth0.pem'),
      key: fs.readFileSync(__dirname + '/test-auth0.key'),
      xpathToNodeBeforeSignature: "//*[local-name(.)='Conditions']",
      signatureNamespacePrefix: 123,
      attributes: {
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'foo@bar.com',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Foo Bar',
        'http://example.org/claims/testemptyarray': [], // should dont include empty arrays
        'http://example.org/claims/testaccent': 'fóo', // should supports accents
        'http://undefinedattribute/ws/com.com': undefined
      }
    };

    var signedAssertion = saml.create(options);
    
    var isValid = utils.isValidSignature(signedAssertion, options.cert);
    assert.equal(true, isValid);
    
    var doc = new xmldom.DOMParser().parseFromString(signedAssertion);
    var audienceRestriction = doc.documentElement.getElementsByTagName('saml:AudienceRestriction');
    assert.equal(audienceRestriction.length, 0);
  });

  it('should not include AttributeStatement when there are no attributes', function () {
    var options = {
      cert: fs.readFileSync(__dirname + '/test-auth0.pem'),
      key: fs.readFileSync(__dirname + '/test-auth0.key'),
      xpathToNodeBeforeSignature: "//*[local-name(.)='Conditions']",
      signatureNamespacePrefix: 123
    };

    var signedAssertion = saml.create(options);

    var isValid = utils.isValidSignature(signedAssertion, options.cert);
    assert.equal(true, isValid);

    var doc = new xmldom.DOMParser().parseFromString(signedAssertion);
    var attributeStatement = doc.documentElement.getElementsByTagName('saml:AttributeStatement');
    assert.equal(attributeStatement.length, 0);
  });

  describe('saml 2.0 full SAML response', function () {

    it('should create a saml 2.0 signed response including plain assertion', function (done) {
      var options = {
        cert: fs.readFileSync(__dirname + '/test-auth0.pem'),
        key: fs.readFileSync(__dirname + '/test-auth0.key'),
        xpathToNodeBeforeSignature: "//*[local-name(.)='Issuer']",
        createSignedSamlResponse: true,
        destination: 'https:/foo.com'
      };

      var samlResponse = saml.create(options);

      var isValid = utils.isValidSignature(samlResponse, options.cert);
      assert.equal(true, isValid);                

      done();
    });    

    it('...with attributes', function (done) {
      var options = {
        cert: fs.readFileSync(__dirname + '/test-auth0.pem'),
        key: fs.readFileSync(__dirname + '/test-auth0.key'),
        xpathToNodeBeforeSignature: "//*[local-name(.)='Issuer']",
        createSignedSamlResponse: true,
        destination: 'https:/foo.com',
        attributes: {
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'foo@bar.com',
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Foo Bar',
          'http://example.org/claims/testaccent': 'fóo', // should supports accents
          'http://undefinedattribute/ws/com.com': undefined
        }        
      };

      var samlResponse = saml.create(options);

      var isValid = utils.isValidSignature(samlResponse, options.cert);
      assert.equal(true, isValid);  
      
      var attributes = utils.getAttributes(samlResponse);
      assert.equal(3, attributes.length);
      assert.equal('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', attributes[0].getAttribute('Name'));
      assert.equal('foo@bar.com', attributes[0].textContent);
      assert.equal('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name', attributes[1].getAttribute('Name'));
      assert.equal('Foo Bar', attributes[1].textContent);
      assert.equal('http://example.org/claims/testaccent', attributes[2].getAttribute('Name'));
      assert.equal('fóo', attributes[2].textContent);      

      done();
    });

    it('should insure SAML response attribute [ID] matches signature reference attribute [URI]', function (done) {
      var options = {
        cert: fs.readFileSync(__dirname + '/test-auth0.pem'),
        key: fs.readFileSync(__dirname + '/test-auth0.key'),
        xpathToNodeBeforeSignature: "//*[local-name(.)='Issuer']",
        createSignedSamlResponse: true,
        destination: 'https:/foo.com'
      };

      var samlResponse = saml.create(options);

      var isValid = utils.isValidSignature(samlResponse, options.cert);
      assert.equal(true, isValid);
      
      var responseData = utils.getResponseData(samlResponse);
      var responseId = responseData.getAttribute('ID');
      var referenceUri = (responseData.getElementsByTagName('Reference')[0].getAttribute('URI')); 
      assert.equal(referenceUri, '#' + responseId);

      done();
    });      

    it('should require a [Destination] attribute on SAML Response element', function (done) {
      var options = {
        cert: fs.readFileSync(__dirname + '/test-auth0.pem'),
        key: fs.readFileSync(__dirname + '/test-auth0.key'),
        xpathToNodeBeforeSignature: "//*[local-name(.)='Issuer']",
        createSignedSamlResponse: true,
        destination: ''
      };

      try{
        var samlResponse = saml.create(options);
      }catch(err){
        assert(err.message.includes('Expect a SAML Response destination for message to be valid.'));
        done();
      }

      throw "Error did not throw as expected!";              
      done();
    });
  });

  describe('encryption', function () {

    it('should create a saml 2.0 signed and encrypted assertion', function (done) {
      var options = {
        cert: fs.readFileSync(__dirname + '/test-auth0.pem'),
        key: fs.readFileSync(__dirname + '/test-auth0.key'),
        encryptionPublicKey: fs.readFileSync(__dirname + '/test-auth0_rsa.pub'),
        encryptionCert: fs.readFileSync(__dirname + '/test-auth0.pem')
      };

      saml.create(options, function(err, encrypted) {
        if (err) return done(err);

        var encryptedData = utils.getEncryptedData(encrypted);
        
        xmlenc.decrypt(encryptedData.toString(), { key: fs.readFileSync(__dirname + '/test-auth0.key')}, function(err, decrypted) {
          if (err) return done(err);
          var isValid = utils.isValidSignature(decrypted, options.cert);
          assert.equal(true, isValid);
          done();
        });
      });
    });

    it('...with assertion attributes', function (done) {
      var options = {
        cert: fs.readFileSync(__dirname + '/test-auth0.pem'),
        key: fs.readFileSync(__dirname + '/test-auth0.key'),
        encryptionPublicKey: fs.readFileSync(__dirname + '/test-auth0_rsa.pub'),
        encryptionCert: fs.readFileSync(__dirname + '/test-auth0.pem'),
        attributes: {
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'foo@bar.com',
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Foo Bar',
          'http://example.org/claims/testaccent': 'fóo', // should supports accents
          'http://undefinedattribute/ws/com.com': undefined
        }
      };

      saml.create(options, function(err, encrypted) {
        if (err) return done(err);

        var encryptedData = utils.getEncryptedData(encrypted);
        
        xmlenc.decrypt(encryptedData.toString(), { key: fs.readFileSync(__dirname + '/test-auth0.key')}, function(err, decrypted) {
          if (err) return done(err);

          var isValid = utils.isValidSignature(decrypted, options.cert);
          assert.equal(true, isValid);

          var attributes = utils.getAttributes(decrypted);
          assert.equal(3, attributes.length);
          assert.equal('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', attributes[0].getAttribute('Name'));
          assert.equal('foo@bar.com', attributes[0].textContent);
          assert.equal('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name', attributes[1].getAttribute('Name'));
          assert.equal('Foo Bar', attributes[1].textContent);
          assert.equal('http://example.org/claims/testaccent', attributes[2].getAttribute('Name'));
          assert.equal('fóo', attributes[2].textContent);

          done();
        });
      });
    });

    describe('full signed SAML 2.0 response with encrypted assertion', function () {

      it('should create a saml 2.0 signed response including encrypted assertion', function (done) {
        var options = {
          cert: fs.readFileSync(__dirname + '/test-auth0.pem'),
          key: fs.readFileSync(__dirname + '/test-auth0.key'),
          encryptionPublicKey: fs.readFileSync(__dirname + '/test-auth0_rsa.pub'),
          encryptionCert: fs.readFileSync(__dirname + '/test-auth0.pem'),
          xpathToNodeBeforeSignature: "//*[local-name(.)='Issuer']",
          createSignedSamlResponse: true,
          destination: 'https:/foo.com'
        };

        saml.create(options, function(err, encrypted) {
          if (err) return done(err);

          var isValid = utils.isValidSignature(encrypted, options.cert);
          assert.equal(true, isValid);
                  
          var encryptedData = utils.getEncryptedData(encrypted);
          
          xmlenc.decrypt(encryptedData.toString(), { key: fs.readFileSync(__dirname + '/test-auth0.key')}, function(err, decrypted) {
            if (err) return done(err);

            done();
          });
        });
      });

      it('...with assertion attributes', function (done) {
        var options = {
          cert: fs.readFileSync(__dirname + '/test-auth0.pem'),
          key: fs.readFileSync(__dirname + '/test-auth0.key'),
          encryptionPublicKey: fs.readFileSync(__dirname + '/test-auth0_rsa.pub'),
          encryptionCert: fs.readFileSync(__dirname + '/test-auth0.pem'),
          xpathToNodeBeforeSignature: "//*[local-name(.)='Issuer']",
          createSignedSamlResponse: true,
          destination: 'https:/foo.com',
          attributes: {
            'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'foo@bar.com',
            'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Foo Bar',
            'http://example.org/claims/testaccent': 'fóo', // should supports accents
            'http://undefinedattribute/ws/com.com': undefined
          }
        };

        saml.create(options, function(err, encrypted) {
          if (err) return done(err);

          var isValid = utils.isValidSignature(encrypted, options.cert);
          assert.equal(true, isValid);

          var encryptedData = utils.getEncryptedData(encrypted);
          
          xmlenc.decrypt(encryptedData.toString(), { key: fs.readFileSync(__dirname + '/test-auth0.key')}, function(err, decrypted) {
            if (err) return done(err);

            var attributes = utils.getAttributes(decrypted);
            assert.equal(3, attributes.length);
            assert.equal('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', attributes[0].getAttribute('Name'));
            assert.equal('foo@bar.com', attributes[0].textContent);
            assert.equal('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name', attributes[1].getAttribute('Name'));
            assert.equal('Foo Bar', attributes[1].textContent);
            assert.equal('http://example.org/claims/testaccent', attributes[2].getAttribute('Name'));
            assert.equal('fóo', attributes[2].textContent);

            done();
          });
        });
      });
    });

    describe('full signed SAML 2.0 response with encryped signed assertion', function () {

      it('should create a saml 2.0 signed response including encrypted signed assertion', function (done) {
        var options = {
          cert: fs.readFileSync(__dirname + '/test-auth0.pem'),
          key: fs.readFileSync(__dirname + '/test-auth0.key'),
          encryptionPublicKey: fs.readFileSync(__dirname + '/test-auth0_rsa.pub'),
          encryptionCert: fs.readFileSync(__dirname + '/test-auth0.pem'),
          xpathToNodeBeforeSignature: "//*[local-name(.)='Issuer']",
          createSignedSamlResponse: true,
          responseSigningLevel: 'AssertionAndResponse',
          destination: 'https:/foo.com'
        };
          var isValid = false;
          saml.create(options, function(err, responseData) {
          if (err) return done(err);

          // Response Signature
          isValid = utils.isValidResponseSignature(responseData, options.cert);
          assert.equal(true, isValid);

          // Assertion Signature
          var isValid = utils.isValidSignature(responseData, options.cert);
          assert.equal(true, isValid);
                  
          var encryptedData = utils.getEncryptedData(responseData);
          
          xmlenc.decrypt(encryptedData.toString(), { key: fs.readFileSync(__dirname + '/test-auth0.key')}, function(err, decrypted) {
            if (err) return done(err);
          });          

          done();
        });
      });

      it('...with assertion attributes', function (done) {
        var options = {
          cert: fs.readFileSync(__dirname + '/test-auth0.pem'),
          key: fs.readFileSync(__dirname + '/test-auth0.key'),
          encryptionPublicKey: fs.readFileSync(__dirname + '/test-auth0_rsa.pub'),
          encryptionCert: fs.readFileSync(__dirname + '/test-auth0.pem'),
          xpathToNodeBeforeSignature: "//*[local-name(.)='Issuer']",
          createSignedSamlResponse: true,
          responseSigningLevel: 'AssertionAndResponse',
          destination: 'https:/foo.com',
          attributes: {
            'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'foo@bar.com',
            'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Foo Bar',
            'http://example.org/claims/testaccent': 'fóo', // should supports accents
            'http://undefinedattribute/ws/com.com': undefined
          }
        };

        saml.create(options, function(err, responseData) {
          if (err) return done(err);

          // Response Signature
          isValid = utils.isValidResponseSignature(responseData, options.cert);
          assert.equal(true, isValid);

          // Assertion Signature
          var isValid = utils.isValidSignature(responseData, options.cert);
          assert.equal(true, isValid);
                  
          var encryptedData = utils.getEncryptedData(responseData);
          
          xmlenc.decrypt(encryptedData.toString(), { key: fs.readFileSync(__dirname + '/test-auth0.key')}, function(err, decrypted) {
            if (err) return done(err);

            var attributes = utils.getAttributes(decrypted);
            assert.equal(3, attributes.length);
            assert.equal('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', attributes[0].getAttribute('Name'));
            assert.equal('foo@bar.com', attributes[0].textContent);
            assert.equal('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name', attributes[1].getAttribute('Name'));
            assert.equal('Foo Bar', attributes[1].textContent);
            assert.equal('http://example.org/claims/testaccent', attributes[2].getAttribute('Name'));
            assert.equal('fóo', attributes[2].textContent);

            done();
          });
        });
      });
    });

  });
});