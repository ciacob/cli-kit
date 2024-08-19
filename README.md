# cli-primer

A utility package for managing command-line arguments, generating help documentation, and handling configuration files in Node.js applications.

> _Note_: This documentation is meant to give you a brief introduction. All the functions in this package's modules have extensive JsDoc documentation of their own. __Make sure to read that__ — you'll be up and running in no time.

## Core Features

- **Argument Parsing**: Code that reads and validates command-line arguments.
- **Help Documentation**: Code that generates and displays help documentation based on argument definitions.
- **Configuration File Handling**:
  - **Initialization**: Code that initializes a configuration file based on a template.
  - **Loading Configuration**: Code that loads and merges configuration data from a file with command-line arguments and default values.
- **File System Utilities**: Helpers to manage directory structures and file content, including cleanup operations.
- **Monitoring and Debugging**: Built-in monitoring function with optional debug mode and application information retrieval.

## Modules

### argTools.js

- **`getArguments(dictionary, defaults = {}, monitoringFn = null)`**: 
  Parses command-line arguments according to a specified dictionary of expected arguments.

- **`getHelp(dictionary, monitoringFn = null)`**: 
  Generates and returns a help string based on the dictionary of expected arguments.

### configTools.js

- **`getConfigData(filePath, profileName, dictionary, monitoringFn = null)`**: 
  Reads a configuration file and returns the settings of a specified profile.

- **`initializeConfig(filePath, template, templateData, monitoringFn = null)`**: 
  Creates and initializes a configuration file from a given template.

### utils.js

- **`ensureSetup(homeDir, bluePrint, monitoringFn = null)`**: 
  Ensures a specific folder structure exists and populates it with files based on templates.

- **`removeFolderContents(folderPath, patterns = [], monitoringFn = null)`**: 
  Removes content of a specified folder without deleting the folder itself.

- **`populateTemplate(template, data)`**: 
  Populates a template string with data from an object.

- **`mergeData(implicit, explicit, given)`**: 
  Merges three data sets, giving precedence to the later sets.

- **`monitoringFn(info)`**:
  A simple monitoring function that prints to the console and returns a Boolean indicating whether the received data denotes an error. It supports enabling or disabling debug messages.

- **`setDebugMode(value)`**:
  Toggles the display of `debug` messages by the `monitoringFn`.

- **`getAppInfo(monitoringFn)`**:
  Reads the `package.json` file of the current Node.js application and returns an object with `name`, `author`, `version`, and `description`.

- **`getDefaultBanner(appInfo)`**:
  Generates a default application banner based on the provided `appInfo` object, with minimal error handling.

## How to Use

### 1. Install the Package

Install `cli-primer` via `npm`, then require it in your Node.js application:
```bash
npm i cli-primer
```
```javascript
const primer = require('cli-primer');
```

### 2. Parse Command-Line Arguments

Use `getArguments` to parse command-line arguments:
```javascript
const args = primer.getArguments(dictionary, defaults, monitoringFn);
```

### 3. Initialize a configuration file
Use `initializeConfig` to create a configuration file stub. The file will provide support for `profiles` that you can target via `getConfigData`. These __get added automatically__ to whatever JSON structure you provide as _template_.
```javascript
const configTemplate = JSON.stringify({
    appInfo: {
        appName: '{{appName}}',
        appDescription: '{{appDesc}}',
        appAuthor: '{{appAuthor}}',
        whateverElse: '{{other}}'
    }
});
primer.initializeConfig ('path/to/my/config.json', configTemplate, {
    appName: 'My app',
    appDesc: 'This is a test application',
    appAuthor: 'John Doe',
    other: 'Lorem ipsum dolor'
}, monitoringFn = null);
```

### 4. Load and Parse a Configuration File
Use `getConfigData` to load and parse a configuration file:
```javascript
const config = primer.getConfigData(configFilePath, profileName, dictionary, monitoringFn);
```

### 5. Set Up Necessary Folders and Files
Use `ensureSetup` to set up necessary folders and files:
```javascript
primer.ensureSetup(homeDir, bluePrint, monitoringFn);
```

### 6. Clean Up a Folder
Use `removeFolderContents` to clean up a folder:
```javascript
await primer.removeFolderContents(folderPath, patterns, monitoringFn);
```

### 7. Toggle Debug Mode
Use `setDebugMode` to enable or disable debug messages in the default `monitoringFn` (accessible as `primer.monitoringFn`):
```javascript
primer.setDebugMode(true); // Enable debug messages
```

### 8. Get Application Information
Use `getAppInfo` to retrieve application information from `package.json`:
```javascript
const appInfo = primer.getAppInfo(monitoringFn);
```

### 9. Generate a Default Application Banner
Use `getDefaultBanner to generate an application banner:
```javascript
const banner = primer.getDefaultBanner(appInfo);
console.log(banner);
```

## Additional Notes
This package is designed to help you streamline the process of building CLI applications by providing reusable functions that handle common tasks. Whether you're building a small script or a complex application, `cli-primer` can save you time and effort.

### Example Use Cases
* __Argument Parsing and Validation__: Handle command-line arguments with built-in validation, default values, and help documentation generation.

* __Configuration Management__: Create and load configuration files with support for profiles and template-based initialization.

* __File Management__: Ensure directory structures are in place and manage content within folders easily.

### Contribution and Development
Feel free to contribute to cli-primer by submitting issues or pull requests. The goal is to keep this toolkit simple yet powerful for CLI app development.