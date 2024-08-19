// index.js

// Requiring all the modules from cli-kit_modules
const argTools = require("./cli-kit_modules/argTools");
const configTools = require("./cli-kit_modules/configTools");
const utils = require("./cli-kit_modules/utils");

// Re-exporting all the functions for convenient access
module.exports = {
  ...argTools,
  ...configTools,
  ...utils,
};

/**
 * cli-kit: A Node.js utility toolkit for building and managing command-line applications.
 * 
 * This package provides a set of tools to help you quickly set up and control the behavior
 * of your CLI applications. It includes functions for argument parsing, configuration file
 * management, and file system operations.
 * 
 * Modules:
 * --------
 * - argTools.js: 
 *   - `getArguments(dictionary, defaults = {}, monitoringFn = null)`: Parses command-line arguments
 *     according to a specified dictionary of expected arguments.
 *   - `getHelp(dictionary, monitoringFn = null)`: Generates and returns a help string based on the
 *     dictionary of expected arguments.
 * 
 * - configTools.js:
 *   - `getConfigData(filePath, profileName, dictionary, monitoringFn = null)`: Reads a configuration file 
 *     and returns the settings of a specified profile.
 *   - `initializeConfig(filePath, template, templateData, monitoringFn = null)`: Creates and initializes
 *     a configuration file from a given template.
 * 
 * - utils.js:
 *   - `ensureSetup(homeDir, bluePrint, monitoringFn = null)`: Ensures a specific folder structure exists 
 *     and populates it with files based on templates.
 *   - `removeFolderContents(folderPath, patterns = [], monitoringFn = null)`: Removes content of a specified 
 *     folder without deleting the folder itself.
 *   - `populateTemplate(template, data)`: Populates a template string with data from an object.
 *   - `mergeData(implicit, explicit, given)`: Merges three data sets, giving precedence to the later sets.
 * 
 * How to Use:
 * -----------
 * 1. Install the package and require it in your Node.js application:
 *    ```javascript
 *    const cliKit = require('path/to/cli-kit');
 *    ```
 * 
 * 2. Use `getArguments` to parse command-line arguments:
 *    ```javascript
 *    const args = cliKit.getArguments(dictionary, defaults, monitoringFn);
 *    ```
 * 
 * 3. Use `getConfigData` to load and parse a configuration file:
 *    ```javascript
 *    const config = cliKit.getConfigData(configFilePath, profileName, dictionary, monitoringFn);
 *    ```
 * 
 * 4. Use `ensureSetup` to set up necessary folders and files:
 *    ```javascript
 *    cliKit.ensureSetup(homeDir, bluePrint, monitoringFn);
 *    ```
 * 
 * 5. Use `removeFolderContents` to clean up a folder:
 *    ```javascript
 *    await cliKit.removeFolderContents(folderPath, patterns, monitoringFn);
 *    ```
 * 
 * This package is designed to help you streamline the process of building CLI applications by providing
 * reusable functions that handle common tasks. Whether you're building a small script or a complex application,
 * cli-kit can save you time and effort.
 */

