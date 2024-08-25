const { storeData } = require('./storeData')

exports.satelliteAPI = function () {
	var self = this
	var host = '127.0.0.1'
	var port = 16622 //self.config.tcpPort
	var timeout = 3000 // 3 sec timeout, sends a ping to the companion host in order to say that we are still there and alive

	if (self.api !== undefined) {
		self.api.destroy()

		if (self.pingSatellite) {
			clearInterval(self.pingSatellite)
		}

		delete self.api
	}

	if (self.config.satEnable) {
		self.api = new self.TCPHelper(host, port)

		self.api.on('status_change', function (status, message) {
			// self.updateStatus(status, message)
		})

		self.api.on('error', function (err) {
			self.data.satConnected = false
			self.data.startupAPI = true
			self.log('debug', 'Network error', err)
			// self.updateStatus(self.STATE_ERROR, err)
			self.log('error', 'Network error: ' + err.message)

			if (self.pingSatellite) {
				clearInterval(self.pingSatellite)
				delete self.pingSatellite
			}
		})

		self.api.on('connect', function () {
			self.data.startupAPI = false

			self.pingSatellite = setInterval(
				() => {
					self.sendAPI('PING') // Ping the companion host
				},
				timeout < 100 ? 100 : timeout
			)
		})

		self.api.on('data', function (data) {
            
			// self.log('debug', 'data: ' + String(data))

			let str_raw = String(data)
			let str_split = str_raw.trim() // remove new line, carage return and so on.            

			str_split = str_split.split('\n')
			for (let index = 0; index < str_split.length; index++) {
				let str = str_split[index]
				// self.log('debug', str)
                

				// Create a satallite device on first connect
				if (str.includes('BEGIN CompanionVersion=') == true) {                    
					let s = self.data.model
					if (s.includes('SK_') == true) {
						s = s.split('SK_')[1]
					}

                    if(!self.config.buttonCount || self.config.buttonCount === '' || self.config.buttonCount === ' '){
                        self.sendAPI(`ADD-DEVICE DEVICEID=${self.data.serial} PRODUCT_NAME="SKAARHOJ ${s}" BITMAPS=false COLORS=true TEXT=true KEYS_TOTAL=32`)
                    }
                    else{
                        self.sendAPI(`ADD-DEVICE DEVICEID=${self.data.serial} PRODUCT_NAME="SKAARHOJ ${s}" BITMAPS=false COLORS=true TEXT=true KEYS_TOTAL=${self.config.buttonCount}`)
                    }

                    
					continue
				}

				// Sycceded in creating device
				if (str.includes('ADD-DEVICE OK')) {
					self.data.satConnected = true
					continue
				}

				// Respond to ping Commands
				if (str.includes('PING') || str.includes('ping')) {
					self.sendAPI('PONG')
					self.log('debug', 'Sent Ping')
					continue
				}

				// Recieved a Brightness Command
				if (str.includes('BRIGHTNESS')) {
					let brightness = str.split('VALUE=')[1].split(' ')[0]
					brightness = Math.round(self.normalizeBetweenTwoRanges(brightness, 0, 100, 0, 8))
					self.sendCommand('PanelBrightness=' + brightness)
					self.log('debug', 'Sent Panel Brightnss: ' + brightness)
					continue
				}

				// Recieved a Clear all Command
				if (str.includes('KEY-CLEAR')) {
					self.sendCommand('Clear')
					self.log('debug', 'Sent Key Clear')
					continue
				}

				// recived a Key-State Command
				if (str.includes('KEY-STATE')) {                    
					self.log('debug', 'Sent Key State')
					self.log('debug', str)
					keyData = {
						text: '',
						color: '',
						type: '',
						pressed: false,
					}

					// TODO: Missing handler to clear buttons that was used previosly, but not with a new config

					let key = 1 + parseInt(str.split('KEY=')[1].split(' ')[0])
					let config_key = String(self.config['btn_' + key])
					let color_key = config_key
					let text_key = config_key                    

					// skip if nothing is selected
					if (config_key == 0 || config_key == '' || config_key == 'undefined') {
						continue
					}

					if (config_key.includes(',')) {
						config_key = config_key.split(',')
						color_key = config_key[0]
						text_key = config_key[1]
					}

					// Store Color Data
					if (str.includes('COLOR=#')) {
						let rawColor = str.split('COLOR=#')[1].split(' ')[0]
						color = parseInt(rawColor, 16)
						let rgb = self.convertIntColorToRawPanelColor(color)
						keyData.color = rgb
						// self.log('debug', rgb)
					}

					// Store Text Data
					if (str.includes('TEXT=')) {
						let data = str.split('TEXT=')[1].split(' ')[0]
						let buff = new Buffer.from(data, 'base64')
						let cmd = buff.toString('ascii')
						keyData.text = cmd
						// self.log('debug', cmd)
					}

					if (str.includes('PRESSED=')) {
						let data = str.split('PRESSED=')[1].split(' ')[0]
						if (data == 'true') {
							keyData.pressed = true
						} else {
							keyData.pressed = false
						}
						// self.log('debug', data)
					}

					// Store Key Type, and override color and text if needed
					if (str.includes('TYPE=')) {
						let type = str.split('TYPE=')[1].split(' ')[0]
						keyData.type = type
						if (type == 'PAGEUP') {
							keyData.text = 'Page Up'
						}
						if (type == 'PAGEDOWN') {
							keyData.text = 'Page Down'
						}
						if (type == 'PAGENUM') {
							keyData.text = 'Page Number'
						}
					}

					// Render Button Color
					if (keyData.color == 128 + 64) {
						self.sendCommand('HWCc#' + color_key + '=128')
						if (keyData.pressed == true) {
							self.sendCommand('HWC#' + color_key + '=36') // ON
						} else {
							if (self.config.autoDim == true) {
								self.sendCommand('HWC#' + color_key + '=5') // Dimmed
							} else {
								self.sendCommand('HWC#' + color_key + '=0') // OFF
							}
						}
					} else {
						self.sendCommand('HWCc#' + color_key + '=' + keyData.color)
						if (keyData.pressed == true) {
							self.sendCommand('HWC#' + color_key + '=36') // ON
						} else {
							self.sendCommand('HWC#' + color_key + '=5') // Dimmed
						}
					}                    

					// Render Button Text
					let cmd = keyData.text
                    let commandString = ``;
                    let buttonLabel = ``;
					// Check if there is a title/text on the button?
					if (cmd.length > 0) {

						if (cmd.length >= 25) {
							x = cmd.split('\\n')
							if (x.length >= 3) {
								cmd = cmd.replace(' ', '\\n')
							}

							if (x.length <= 2) {
								// cmd = cmd.substr(0, 24) + '\\n' + cmd.substr(24, cmd.length)
								y = cmd.match(/.{1,24}/g)
								// console.log(y.length)
								if (y.length <= 2) {
									cmd = y[0] + '\\n' + y[1]
								} else if (y.length >= 3) {
									cmd = y[0] + '\\n' + y[1] + '\\n' + y[2]
								}
							}
						}

						// If the text includes a line break, replace it with a space
						if (cmd.includes('\\n')) {                          
							x = cmd.split('\\n')
							if (x.length == 2) {
                                if(self.config.showComLabels === true){buttonLabel = `Comp Key: ${key}`;}
                                commandString = `HWCt#${text_key}=|||${buttonLabel}|1|${x[0]}|${x[1]}|`;
							} else if (x.length == 3) {
								commandString = 'HWCt#' + text_key + '=' + '|||' + x[0] + '|1|' + x[1] + '|' + x[2] + '|';
							} else {
								cmd = cmd.split('\\n').join(' ')
                                if(self.config.showComLabels === true){buttonLabel = `Comp Key: ${key}`;}
                                commandString = `HWCt#${text_key}=|||${buttonLabel}|1|${cmd}||`;
							}                            
						} else {
                            if(self.config.showComLabels === true){buttonLabel = `Comp Key: ${key}`;}
                            commandString = `HWCt#${text_key}=|||${buttonLabel}|1|${cmd}||`;
						}
					} else {
						// Send Placeholder Text to the LCD's if there is no other text

                        if(self.config.showComLabels === false){
                            commandString = `HWCt#${text_key}=||||1|${key}||`;
                        }
                        else{
                            commandString = `HWCt#${text_key}=|||Comp Keys:|1|${key}||`;
                        }
					}


                    self.sendCommand(commandString);

					// Store Streamdeck Button States Internaly:
					self.sdData.keys[key - 1] = keyData
					continue
				}                
			}
		})
	}
	return self
}

exports.sendAPI = async function (message) {
	if (message !== undefined) {
		if (this.api !== undefined) {
			this.api.send(message + '\r\n')
			this.log('debug', 'Sent to Satellite: ' + message)
		} else {
			this.log('debug', 'Socket not connected')
		}
		await setTimeout[Object.getOwnPropertySymbols(setTimeout)[0]](100) // 5 mili sec
	}
}

exports.hwcToSat = function() {
    self = this
    var x = self.data.hwc

    // IF the HWC ID is 0 return
    if (x.id == '0') { return }

    // self.log('debug', x)

    // Tackle Encoders, Joysticks and Faders
    if (x.type == 'Encoder') {
        if (x.val == -1 || x.val == 1) {
            x.press = 'true'
        }
    } else if (x.type == 'Joystick') {
        let deadzone = 100

        // Press
        if (x.val >= deadzone || x.val <= (deadzone*-1)) {
            x.press = 'true'
        } 

        // Release
        else if (x.val > (deadzone*-1) || x.val < deadzone) {
            x.press = 'false'
        } 
    } else if (x.type == 'Fader') {
        let center = 500
        let deadzone = 200 
        let val = x.val-center

        // Press
        if (val >= deadzone || val <= (deadzone*-1)) {
            x.press = 'true'
        } 

        // Release
        else if (val > (deadzone*-1) || val < deadzone) {
            x.press = 'false'
        } 
    }

    // check if it's atleast a press or a release, if not return
    if (x.press == '') { return }    

    let configButtons = [];
    for (const [theName, theValue] of Object.entries(self.config)) {
        if(theName.startsWith('btn_') && theValue != ''){
            let theObject = {
                id: Number(theName.replaceAll('btn_', '')),
                name: theName,
                value: theValue
            }
            configButtons.push(theObject)
        }
    }


    configButtons.forEach(singleButton => {
        let compareSting = String(singleButton.value).split(',')[0];

        if(x.id === compareSting){
            console.log(`KEY-PRESS DEVICEID=${self.data.serial} KEY=${(singleButton.id - 1)} PRESSED=${x.press}`);
            
            self.sendAPI(`KEY-PRESS DEVICEID=${self.data.serial} KEY=${(singleButton.id - 1)} PRESSED=${x.press}`);

            if (x.type == 'Encoder') {
                self.sendAPI(`KEY-PRESS DEVICEID=${self.data.serial} KEY=${(singleButton.id - 1)} PRESSED=false`);
            }
        }
    }) 
}
