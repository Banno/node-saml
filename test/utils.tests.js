var assert = require("assert"),
  utils = require("../lib/utils");

describe("saml 1.1", function() {
	describe("pemToCert", function() {
		it("should not throw when the cert is invalid", function() {
			var cert = utils.pemToCert('abc');
			assert.ok(!cert);
		});
	});

	describe("uid", function() {
		it("should not rely on Math.random to generate identifiers", function() {
			var originalRandom = Math.random;
			Math.random = function() { return 0; };
			try {
				var uid = utils.uid(32);
				assert.equal(uid.length, 32);
				assert.ok(/^[A-Za-z0-9]{32}$/.test(uid));
				assert.notEqual(uid, new Array(33).join('A'));
			} finally {
				Math.random = originalRandom;
			}
		});
	});
});
