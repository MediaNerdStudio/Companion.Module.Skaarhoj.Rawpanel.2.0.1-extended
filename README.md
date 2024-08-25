# companion-module-skaarhoj-rawpanel-extended

This module is a fork of the original [companion-module-skaarhoj-rawpanel](https://github.com/bitfocus/companion-module-skaarhoj-rawpanel/) and will connect to a SKAARHOJ Unisketch panel running in "Raw Panel" mode.
It has been modified to handle more buttons as I needed more than the default 32 buttons to be mapped.
The Skaarhoj FlyPack Duo has 48 buttons and 24 LED's. This meant a minimum of 72 buttons that needed to be mapped.
The button count passthrough can now be altered in the Device Connection Options.
Companion's original module had a limit of 32 buttons.
For more info on how to use the module, please take a look at the file [help.md](https://github.com/bitfocus/companion-module-skaarhoj-rawpanel/blob/main/HELP.md)

For info about the module's [license, please look at the License file](https://github.com/bitfocus/companion-module-skaarhoj-rawpanel/blob/main/LICENSE)

Things to fix:
 - Add support for encoders on one hwc, same way as it's used on the StreamDeck+
 - Look into adding feedback functions back or the same functionality in another way
 - Trying to fix the build-in functions to update button 

# Installation
 - Make sure you have node 18 installed (tip: use Fast Node Manager - fnm. CAUTION!! NodeJS higher then 18 won't work)
 - Place the repo in the Developers module path.
 - "npm install" or "yarn install" in the module path to install all the dependencies.
 - Restart Companion
 - The connection will show up as "SKAARHOJ: Raw Panel Extended"

# Path Notes

**V2.0.1-extended**
 - First release for the extended plugin.
 - Reworked the options menu
 - Added more buttons to be mapped (Skaarhoj FlyPack Duo has 48 buttons + 24 LED's)
 - Added option to pass more buttons from pages (original had only a max of 32)
 - Added option to remove top "adress bar" on the LCD. Skahooj panels have small LCD's. This option maximized the realestate
 - Optimized some functions. The original code had a lot of "old" javascript functions like switch and "plus-stringconstruction"


 Added option to define number of buttons to be passed through the API:
 ![Button Passthrough Count](companion/Images/rawpanel-extended-buttoncount.png?raw=true 'Button Passthrough Count')

 Updated mapping section. Added more options + LED feedback "buttons":
 ![Updated Mapping Section](companion/Images/rawpanel-extended-buttonmapping.png.png?raw=true 'Updated Mapping Section')

 Added option show or hide the labels in the Skarhooj LCD's. The option doesn't follow the button option (future update?):
 ![Show or hide labels](companion/Images/rawpanel-extended-showlabels.png?raw=true 'Show or hide labels')

 An example Companion page. Added 8 rows to accomodate all the extra buttons. Skipped the last 2 colums because of OCD:
 ![Example Companion Page](companion/Images/rawpanel-extended-companionpage.png?raw=true 'Example Companion Page')