'use strict';

const fetch = require('node-fetch');
const https = require('https');

module.exports = (function() {

  const api = {};

  const http_agent = new https.Agent({
    rejectUnauthorized: false,
  });

  /**
   * Async function to perform an 'identify' request to the HomeWizard Energy device.
   *
   * @async
   * @param {string} url - The URL of the HomeWizard Energy device.
   * @param {string} token - The token for authentication.
   * @throws {Error} Throws an error if the URL or token is not defined.
   * @throws {Error} Throws an error if the response is not ok.
   *
   * @returns {Promise<void>} A promise that resolves when the request is successful.
   */
  api.identify = async function(url, token) {
    if (!url) throw new Error('URL is not defined');
    if (!token) throw new Error('Token is not defined');

    const res = await fetch(`${url}/api/system/identify`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      agent: http_agent, // Ignore SSL errors
    }).catch(((err) => {
      throw new Error(`Network error: ${err.message}`);
    }));

    // Check if the response is ok (status code 200-299)
    if (!res.ok) { throw new Error(res.statusText); }
  };

  /**
   * Async function to perform an 'identify' request to the HomeWizard Energy device.
   *
   * @async
   * @param {string} url - The URL of the HomeWizard Energy device.
   * @param {string} token - The token for authentication.
   * @throws {Error} Throws an error if the URL or token is not defined.
   * @throws {Error} Throws an error if the response is not ok.
   *
   * @returns {Promise<data>} A promise that resolves with the response data when the request is successful.
   */
  api.getMeasurement = async function(url, token) {
    if (!url) throw new Error('URL is not defined');
    if (!token) throw new Error('Token is not defined');

    const res = await fetch(`${url}/api/measurement`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      agent: http_agent, // Ignore SSL errors
    }).catch(((err) => {
      throw new Error(`Network error: ${err.message}`);
    }));

    // Check if the response is ok (status code 200-299)
    if (!res.ok) { throw new Error(res.statusText); }

    return res.json();
  };

  return api;
}());
