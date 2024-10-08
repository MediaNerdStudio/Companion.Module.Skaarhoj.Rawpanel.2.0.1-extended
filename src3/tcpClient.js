const { InstanceStatus } = require('@companion-module/base')

exports.tcpClient = function () {
	var self = this
	var host = self.config.host
	var port = self.config.tcpPort
	var timeout = self.config.timeout || 5000 // 5 sec timeout, sends a ping to the device in order to check if it's still there
	var refresh = self.config.refresh || 30000 // 30 sec LCD refresh, sends the LCD's to the device in order to update old stuff, if it got missed

	if (self.tcp !== undefined) {
		self.tcp.destroy()

		if (self.pollAPI) {
			clearInterval(self.pollAPI)
		}

		if (self.Refresh) {
			clearInterval(self.Refresh)
		}

		delete self.tcp
	}

	if (self.config.host) {
		self.tcp = new self.TCPHelper(host, port)

		self.tcp.on('status_change', (status, message) => {
			self.updateStatus(status, message)
		})

		self.tcp.on('error', (err) => {
			self.log('debug', 'Network error', err)
			self.updateStatus(InstanceStatus.UnknownError, err)
			self.log('error', 'Network error: ' + err.message)

			if (self.pollAPI) {
				clearInterval(self.pollAPI)
				delete self.pollAPI
			}

			if (self.Refresh) {
				clearInterval(self.Refresh)
				delete self.Refresh
			}

			self.sendAPI('QUIT')
			self.data.satConnected = false
			self.data.startupAPI = true
			if (self.api !== undefined) {
				self.api.destroy()
				delete self.api
			}
		})

		self.tcp.on('connect', () => {
			self.updateStatus(InstanceStatus.Ok)
			self.data.startup = false
			self.log('debug', 'Connected to panel: ' + host + ':' + port)
			if (self.config.debug == true) {
				self.log('warn', 'Connected to panel: ' + host + ':' + port)
			}

			self.sendCommand('PanelTopology?') // Ask for the Panel Topology when connected
			self.sendCommand('Clear') // Clear old data

			self.pollAPI = setInterval(
				() => {
					self.sendCommand('ping') // Ping the panel
					// self.sendCommand('list') // Get model and version on connection
				},
				timeout < 100 ? 100 : timeout
			)
			self.Refresh = setInterval(
				() => {
					self.checkFeedbacks('tieToHwcLed') // Send initial LED data to the panel
					self.checkFeedbacks('tieToLcd') // Send initial LCD data to the panel

					// Send stored data to panel if a shit state is changed
					for (let index = 0; index < this.sdData.keys.length; index++) {
						let key = index + 1

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
	
						let keyData = this.sdData.keys[index]

						// skip if nothing is selected
						if (config_key == 0 || config_key == '' || keyData == undefined) {
							continue
						}

						// Render Button Color
						if (keyData.color !== '') {
							let rgb = keyData.color
							if (rgb == 128 + 64) {
								if (self.config.autoDim == true) {
									self.sendCommand('HWCc#' + color_key + '=128')
									self.sendCommand('HWC#' + color_key + '=5') // Dimmed
								} else {
									self.sendCommand('HWC#' + color_key + '=0') // OFF
								}
							} else {
								self.sendCommand('HWCc#' + color_key + '=' + rgb)
								self.sendCommand('HWC#' + color_key + '=36') // ON
							}
						}

						if (keyData.text !== '') {
							cmd = keyData.text
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
										// console.log(x.length)
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
						}
					}
				},
				refresh < 100 ? 100 : refresh
			)

			self.sendCommand('list') // Get model and version on connection
			self.checkFeedbacks('tieToHwcLed') // Send initial LED data to the panel
			self.checkFeedbacks('tieToLcd') // Send initial LCD data to the panel
			self.sendCommand('encoderPressMode=1') // Enable "Press" response from encoders on the panel
		})

		let messageBuffer = ''
		self.tcp.on('data', (data) => {
			let str_raw = String(data)
			let str = str_raw.trim() // remove new line, carage return and so on.
			str_1 = str.split('\n')

			// If we recived a Panel topology HWC Layout:
			for (let index = 0; index < str_1.length; index++) {
				messageBuffer += str_1[index]
				if (messageBuffer.endsWith('}}}')) {
					let jsonBuffer = ''

					messageBuffer
						.split('\n')
						.filter((message) => message != '')
						.forEach((message) => {
							if (message.startsWith('_panelTopology_svgbase=') || jsonBuffer.length > 0) {
								jsonBuffer += message
								if (jsonBuffer.includes('_panelTopology_HWC=') && jsonBuffer.includes('}}}')) {
									self.handleJSON.bind(this)(jsonBuffer)
									// self.log('debug', jsonBuffer)
									jsonBuffer = ''
								}
							}
						})

					messageBuffer = ''
				}
			}

			// respond to status messages (not really used when panel is in server mode)
			switch (str) {
				case 'list':
					socket.send('\nActivePanel=1\n')
					self.log('debug', 'list - send ActivePanel=1')
					break
				case 'ping':
					socket.send('ack\n')
					self.log('debug', 'ping - send: ack')
					break
				case 'ack':
					self.updateStatus(InstanceStatus.Ok)
					break

				default:
					str_line = str.split('\n')
					for (let index = 0; index < str_line.length; index++) {
						// self.log('debug', str_line[index])
						self.storeData(str_line[index])
					}
					break
			}
		})
	}
	return self
}
