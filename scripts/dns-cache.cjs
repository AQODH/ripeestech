const dns = require("node:dns");

const hosts = {
  "api.cloudflare.com": "104.19.192.176",
  "dash.cloudflare.com": "104.17.110.184"
};

const originalLookup = dns.lookup.bind(dns);

dns.lookup = function (hostname, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  if (hosts[hostname]) {
    const ip = hosts[hostname];
    if (options && options.all) {
      return process.nextTick(callback, null, [{ address: ip, family: 4 }]);
    }
    return process.nextTick(callback, null, ip, 4);
  }
  return originalLookup(hostname, options, callback);
};
