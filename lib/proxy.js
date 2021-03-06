// Copyright 2015 SAP SE.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http: //www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
// either express or implied. See the License for the specific
// language governing permissions and limitations under the License.

'use strict';

var url = require('url');
var httpProxy = require('http-proxy');

var env = {
	noProxy: process.env.NO_PROXY || process.env.no_proxy,
	httpProxy: process.env.HTTP_PROXY || process.env.http_proxy,
	httpsProxy: process.env.HTTPS_PROXY || process.env.https_proxy
};

// inspired by https://github.com/request/request/blob/33cd9e297a00c5540e55778a24a706effc35434c/request.js#L169
function getProxyUri(uri) {

	if (uri.protocol === 'https:' && env.httpsProxy || uri.protocol === 'http:' && env.httpProxy) {

		if (env.noProxy) {
			var canonicalHost = uri.host.replace(/^\.*/, '.');
			var port = uri.port || (uri.protocol === 'https:' ? '443' : '80');

			var patterns = env.noProxy.split(',');
			for (var i = patterns.length - 1; i >= 0; i--) {
				var pattern = patterns[i].trim().toLowerCase();

				// don't use a proxy at all
				if (pattern === '*') {
					return null;
				}

				pattern = pattern.replace(/^\.*/, '.');

				// add port if no specified
				if (pattern.indexOf(':') === -1) {
					pattern += ':' + port;
				}

				// if host ends with pattern, no proxy should be used
				if (canonicalHost.indexOf(pattern) === canonicalHost.length - pattern.length) {
					return null;
				}
			}
		}

		if (uri.protocol === 'https:' && env.httpsProxy) {
			return env.httpsProxy;
		} else if (uri.protocol === 'http:' && env.httpProxy) {
			return env.httpProxy;
		}
	}

	return null;
}

module.exports = function(options) {

	var urlPattern = /^\/(http|https)\/(.*)/;
	var proxy = httpProxy.createProxyServer(options || {});

	return function(req, res, next) {

		// parse the request url
		var parts = urlPattern.exec(req.url);
		if (!parts) {
			return next();
		}

		// parse target url
		var uri = url.parse(parts[1] + '://' + parts[2]);

		// change original request url to target url
		req.url = uri.path;

		// change original host to target host
		req.headers.host = uri.host;

		// get proxy for uri (if defined in env vars)
		var targetUri = getProxyUri(uri) || uri.protocol + '//' + uri.host;

		// proxy the request
		proxy.proxyRequest(req, res, {
			target: targetUri
		}, function(err) {
			if (err) {
				next(err);
			}
		});

	};

};
