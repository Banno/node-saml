# Banno Info

## Banno Release Process
After a pull request is merged into master you may want to release a new version of the @banno/saml package.
To do this follow the process defined below on your development machine:

1. Switch branch to master
   - `git switch master`
2. Get the latest changes from the remote
   - `git pull`
3. Increment version
   - `npm version minor`
4. Publish to Artifactory
   - `npm publish`

At this point a new version has been created and published to Artifactory. You can now update any dependent products to
this new version.

---
## Original README:

---

Create SAML assertions.

NOTE: currently supports SAML 1.1 tokens

[![Build Status](https://travis-ci.org/auth0/node-saml.png)](https://travis-ci.org/auth0/node-saml)

### Usage

```js
var saml11 = require('saml').Saml11;

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
  nameIdentifier: 'foo',
  sessionIndex: '_faed468a-15a0-4668-aed6-3d9c478cc8fa'
};

var signedAssertion = saml11.create(options);
```

Everything except the cert and key is optional.

## Issue Reporting

If you have found a bug or if you have a feature request, please report them at this repository issues section. Please do not report security vulnerabilities on the public GitHub issue tracker. The [Responsible Disclosure Program](https://auth0.com/whitehat) details the procedure for disclosing security issues.

## Author

[Auth0](auth0.com)

## License

This project is licensed under the MIT license. See the [LICENSE](LICENSE) file for more info.
