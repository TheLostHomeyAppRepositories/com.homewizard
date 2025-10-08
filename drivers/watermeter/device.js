'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');

const http = require('http');

const agent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs : 11000
});

//const POLL_INTERVAL = 1000 * 10; // 10 seconds

module.exports = class HomeWizardEnergyWatermeterDevice extends Homey.Device {

  async onInit() {

    const settings = this.getSettings();
    console.log('Offset polling for Watermeter: ',settings.offset_polling);


    // Check if polling interval is set in settings, if not set default to 10 seconds
    if ((settings.offset_polling === undefined) || (settings.offset_polling === null)) {
      settings.offset_polling = 10; // Default to 10 second if not set
      await this.setSettings({
        // Update settings in Homey
        offset_polling: 10,
      });
    }

    if ((settings.offset_water === undefined) || (settings.offset_water === null)) {
      settings.offset_water = 0; // Default to 0 second if not set
      await this.setSettings({
        // Update settings in Homey
        offset_water: 0,
      });
    }

    this.onPollInterval = setInterval(this.onPoll.bind(this), 1000 * settings.offset_polling);
    

    this.registerCapabilityListener('identify', async (value) => {
      await this.onIdentify();
    });

      // Save export data check if capabilities are present first
      if (!this.hasCapability('measure_water')) {
        await this.addCapability('measure_water').catch(this.error);
      }

      if (!this.hasCapability('meter_water')) {
        await this.addCapability('meter_water').catch(this.error);
      }

      if (!this.hasCapability('identify')) {
        await this.addCapability('identify').catch(this.error);
      }

      if (!this.hasCapability('rssi')) {
        await this.addCapability('rssi').catch(this.error);
      }

  }

  onDeleted() {
    if (this.onPollInterval) {
      clearInterval(this.onPollInterval);
      this.onPollInterval = null;
    }
  }

  onDiscoveryAvailable(discoveryResult) {
    this.url = `http://${discoveryResult.address}:${discoveryResult.port}${discoveryResult.txt.path}`;
    this.log(`URL: ${this.url}`);
    this.onPoll();
  }

  onDiscoveryAddressChanged(discoveryResult) {
    this.url = `http://${discoveryResult.address}:${discoveryResult.port}${discoveryResult.txt.path}`;
    this.log(`URL: ${this.url}`);
    this.log('onDiscoveryAddressChanged');
    this.onPoll();
  }

  onDiscoveryLastSeenChanged(discoveryResult) {
    this.url = `http://${discoveryResult.address}:${discoveryResult.port}${discoveryResult.txt.path}`;
    this.log(`URL: ${this.url}`);
    this.setAvailable();
    this.onPoll();
  }

  async onIdentify() {
    if (!this.url) return;

    let res;
    try {
      res = await fetch(`${this.url}/identify`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      this.error(err);
      throw new Error('Network error during onIdentify');
    }

    if (!res || !res.ok) {
      await this.setCapabilityValue('connection_error', res ? res.status : 'fetch failed');
      throw new Error(res ? res.statusText : 'Unknown error during fetch');
    }
  }


   async setCloudOn() {
      if (!this.url) return;
  
      let res;
      try {
        res = await fetch(`${this.url}/system`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cloud_enabled: true })
        });
      } catch (err) {
        this.error(err);
        throw new Error('Network error during setCloudOn');
      }
  
      if (!res || !res.ok) {
        throw new Error(res ? res.statusText : 'Unknown error during fetch');
      }
    }
  
  
    async setCloudOff() {
      if (!this.url) return;
  
      let res;
      try {
        res = await fetch(`${this.url}/system`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cloud_enabled: false })
        });
      } catch (err) {
        this.error(err);
        throw new Error('Network error during setCloudOff');
      }
  
      if (!res || !res.ok) { 
        throw new Error(res ? res.statusText : 'Unknown error during fetch'); 
      }
    }

  async onPoll() {

    const settings = this.getSettings();

    if (!this.url) {
      if (settings.url) {
        this.url = settings.url;
      }
      else return;
    }

    if (!this.onPollInterval) {
        this.log('Watermeter - Polling interval is not running, starting now...');
        // Clear any possible leftover interval just in case
        this.onPollInterval = setInterval(this.onPoll.bind(this), 1000 * settings.polling_interval);
    }

    Promise.resolve().then(async () => {

      //let res = await fetch(`${this.url}/data`);

      const res = await fetch(`${this.url}/data`, {
          agent,
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
      });

      if (!res || !res.ok) {
         throw new Error(res ? res.statusText : 'Unknown error during fetch'); 
      }

      const data = await res.json();

      let offset_water_m3;

      // if watermeter offset is set in Homewizard Energy app take that value else use the configured value in Homey Homewizard water offset

      const settings = this.getSettings();
      //console.log('Offset for Watermeter: ',settings.offset_water);


      if (data.total_liter_offset_m3 = '0') {
        offset_water_m3 = settings.offset_water;
      }
      else if (data.total_liter_offset_m3 != '0') {
        offset_water_m3 = data.total_liter_offset_m3;
      }



      const temp_total_liter_m3 = data.total_liter_m3 + offset_water_m3;

      // Update values
      if (this.getCapabilityValue('measure_water') != data.active_liter_lpm)
      { await this.setCapabilityValue('measure_water', data.active_liter_lpm).catch(this.error); }
      if (this.getCapabilityValue('meter_water') != temp_total_liter_m3)
      { await this.setCapabilityValue('meter_water', temp_total_liter_m3).catch(this.error); }
      if (this.getCapabilityValue('rssi') != data.wifi_strength)
      { await this.setCapabilityValue('rssi', data.wifi_strength).catch(this.error); }

      if (this.url != settings.url) {
            this.log("Watermeter - Updating settings url");
            await this.setSettings({
                  // Update url settings
                  url: this.url
                });
      }


    })
      .then(() => {
        this.setAvailable().catch(this.error);
      })
      .catch((err) => {
        this.error(err);
        this.setUnavailable(err).catch(this.error);
      });
  }

  // Catch offset updates
    /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} onSettings event data
   * @param {object} oldSettings The old settings object
   * @param {object} newSettings The new settings object
   * @param {string[]} changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings(oldSettings) {
    this.log('Settings updated')
    // Update display values if offset has changed
        // Retrieve changedKeys from oldSettings
    const changedKeys = oldSettings.changedKeys || [];
    this.log('Debug: Updated keys =', changedKeys);

    if (changedKeys == 'offset_water') {
      this.log('Updating offset_water', oldSettings.newSettings.offset_water);
        
    }
    else if (changedKeys === 'offset_polling') {
            this.log('Updating polling interval to', oldSettings.newSettings.offset_polling);

            // Ensure polling interval is a valid number
            if (typeof oldSettings.newSettings.offset_polling === 'number' && oldSettings.newSettings.offset_polling > 0) {
                if (this.onPollInterval) {
                    clearInterval(this.onPollInterval);
                }
                this.onPollInterval = setInterval(this.onPoll.bind(this), oldSettings.newSettings.offset_polling * 1000); // Convert to ms
            } else {
                this.log('Invalid polling interval:', oldSettings.newSettings.offset_polling);
            }
        }
        else if (changedKeys === 'cloud') {
            this.log('Updating cloud connection', oldSettings.newSettings.cloud);

            try {
            if (oldSettings.newSettings.cloud == 1) {
            this.setCloudOn();  
            }
            else if (oldSettings.newSettings.cloud == 0) {
            this.setCloudOff();
            }
        } catch (err) {
          this.error('Failed to update cloud connection:', err);
        }

      }




    //return true;
  }
  

  updateValue(cap, value) {
    // add offset if defined
    this.log('Updating value of', this.id, 'with capability', cap, 'to', value);
    const cap_offset = cap.replace('meter', 'offset');
    const offset = this.getSetting(cap_offset);
    this.log(cap_offset, offset);
    if (offset != null) {
      value += offset;
    }
    this.setCapabilityValue(cap, value)
      .catch((err) => this.error(err));
  }

};
