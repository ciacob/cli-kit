// shared utility functions
const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");
const glob = require("glob");

let _showDebug = false;

/**
 * Simple monitoring function. Prints to console and returns a Boolean indicating
 * whether received data appears to denote an error.
 *
 * @param   {Object} info
 *          Object containing the following keys:
 *          - `type` (String): The type of message (`info`, `warn`, `error`, `debug`).
 *          - `message` (String): The message content to be displayed.
 *          - `data` (Object, optional): Additional data related to the message, displayed as an object.
 *
 * @returns {Boolean}
 *          Returns `true` if `info.type` is `"error"`, indicating an error occurred.
 *          Returns `false` otherwise.
 */
const monitoringFn = (info) => {
  if (!info || typeof info !== "object") {
    console.error("[ERROR] Invalid info object provided to `monitoringFn`.");
    return true;
  }

  const { type = "", message = "", data = "" } = info;
  const normalizedType = ("" + type).trim().toLowerCase();

  // Only show debug messages when `_showDebug` is `true`.
  const isDebug = normalizedType === "debug";
  if (isDebug && !_showDebug) {
    return false;
  }

  const isError = normalizedType === "error";
  console.log(`[${normalizedType.toUpperCase()}] ${message}`, data || "");
  return isError;
};

/**
 * Enables or disables the display of `debug` messages by the `monitoringFn`.
 *
 * @param {Boolean} value
 *          Set to `true` to include `debug` messages in the output of the `monitoringFn`.
 *          Set to `false` to exclude them.
 *
 * @returns {void}
 */
function setDebugMode(value) {
  _showDebug = !!value;
}

/**
 * Reads the `package.json` file of the current Node.js application and returns an object
 * containing basic application information.
 *
 * @param {Function} [monitoringFn=null]
 *        Optional function to receive real-time monitoring information.
 *        Expected signature/arguments structure is: onMonitoringInfo
 *        ({type:"info|warn|error", message:"<any>"[, data : {}]});
 *
 * @returns {Object}
 *          An object containing the following properties:
 *          - `name` (String): The name of the application. Defaults to `"Unknown app"`
 *             if missing.
 *          - `author` (String): The author of the application. Defaults to an empty
 *             string if missing.
 *          - `version` (String): The version of the application. Defaults to an
 *             empty string if missing.
 *          - `description` (String): The description of the application. Defaults
 *             to an empty string if missing.
 */
function getAppInfo(monitoringFn = null) {
  const $m = monitoringFn || function () {};

  const packageJsonPath = path.resolve(process.cwd(), "package.json");
  let appInfo = {
    name: "Unknown app",
    author: "",
    version: "",
    description: "",
  };

  try {
    if (fs.existsSync(packageJsonPath)) {
      const packageData = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

      appInfo.name = packageData.name || appInfo.name;
      appInfo.author = packageData.author || appInfo.author;
      appInfo.version = packageData.version || appInfo.version;
      appInfo.description = packageData.description || appInfo.description;

      $m({
        type: "debug",
        message: `Successfully read package.json from path: ${packageJsonPath}`,
        data: appInfo,
      });
    } else {
      $m({
        type: "warn",
        message: `package.json not found at path: ${packageJsonPath}`,
      });
    }
  } catch (error) {
    $m({
      type: "warn",
      message: `Failed to read package.json. Details: ${error.message}`,
      data: { error },
    });
  }

  return appInfo;
}

/**
 * Generates a default application banner based on the provided appInfo object.
 * If the appInfo object is missing or an error occurs while accessing its properties,
 * the function returns a string containing only three dashes ("---").
 *
 * @param {Object} appInfo
 *        The object containing application information. Typically returned by
 *        `getAppInfo()`.
 *        Should contain the following properties:
 *        - `name` (String): The name of the application.
 *        - `author` (String): The author of the application.
 *        - `version` (String): The version of the application.
 *        - `description` (String): The description of the application.
 *
 * @returns {String}
 *          The generated application banner or a string containing three dashes ("---")
 *          in case of an error.
 */
function getDefaultBanner(appInfo) {
  try {
    if (!appInfo) throw new Error("Invalid appInfo object");
    const { name, version, author, description } = appInfo;
    let banner = `${name}`;
    if (version) {
      banner += ` ${version}`;
    }
    if (author) {
      banner += `\nby ${author}`;
    }
    if (description) {
      banner += `\n${description}`;
    }
    banner += `\n---`;
    return banner;
  } catch (error) {
    // Return a string containing three dashes if an error occurs
    return "---";
  }
}

/**
 * Ensures a specific folder structure exists and populates it with files based on templates.
 * @param {String} homeDir
 *        An absolute path to the base directory.
 *
 * @param {Object} bluePrint
 *        A blueprint object describing the structure and content, such as:
 *        {
 *          content: [
 *            { type: "folder", path: "/path/to/my/folder" },
 *            {
 *              type: "file",
 *              path: "/path/to/my/folder/my_file.txt",
 *              template: "Hello world! My name is {{firstName}} {{lastName}}.",
 *              data: { firstName: "John", lastName: "Doe" },
 *            },
 *            { type: "folder", path: "/path/to/my/other/folder" },
 *          ],
 *        }
 *        The `content` property of this Object is mandatory, and must resemble the
 *        above example. Other free-form information can as well be stored in the
 *        Object, to aid in the process.
 *
 * @param {Function} [monitoringFn=null]
 *        Optional function to receive real-time monitoring information.
 *        Expected signature/arguments structure is: onMonitoringInfo
 *        ({type:"info|warn|error", message:"<any>"[, data : {}]});
 *
 * @returns {String[]}
 *          Returns an Array of Strings, one String for each path that was created.
 *          This is a side-effect, and might be useful for further processing.
 */
function ensureSetup(homeDir, bluePrint, monitoringFn = null) {
  const $m = monitoringFn || function () {};
  const createdPaths = [];

  try {
    // Sort content by path alphabetically
    bluePrint.content.sort((a, b) => a.path.localeCompare(b.path));

    // Ensure all directories and files exist
    for (const item of bluePrint.content) {
      const itemPath = path.join(homeDir, item.path);

      if (item.type === "folder") {
        // Create folder if it doesn't exist
        if (!fs.existsSync(itemPath)) {
          fs.mkdirSync(itemPath, { recursive: true });
          $m({ type: "info", message: `Created folder: ${itemPath}` });
          createdPaths.push(itemPath);
        }
      } else if (item.type === "file") {
        // Ensure the parent directory exists
        const dir = path.dirname(itemPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          $m({
            type: "info",
            message: `Created parent directory for file: ${dir}`,
          });
          createdPaths.push(dir);
        }

        // Create and populate the file based on the template and data
        const content = populateTemplate(item.template, item.data);
        fs.writeFileSync(itemPath, content, "utf8");
        $m({ type: "info", message: `Created file: ${itemPath}` });
        createdPaths.push(itemPath);
      }
    }
  } catch (error) {
    $m({
      type: "error",
      message: `Error in ensureSetup. Details: ${error.message}`,
      data: { error },
    });
  }
  createdPaths.sort();
  return createdPaths;
}

/**
 * Removes content of a specified folder without deleting the folder itself.
 * @async
 *
 * @param   {string} folderPath
 *          The path to the folder whose contents should be removed.
 *
 * @param   {string[]} [patterns=[]]
 *          An array of strings representing file or folder patterns to match for deletion.
 *          Supports wildcards (* for any characters, ? for one character). Empty strings
 *          will be ignored. If the array is null or empty, all contents will be deleted.
 *
 * @param   {Function} [monitoringFn=null]
 *          Optional function to receive real-time monitoring information.
 *          Expected signature/arguments structure is:
 *          onMonitoringInfo ({type:"info|warn|error", message:"<any>"[, data : {}]});
 *
 * @returns {String[]}
 *          Returns an Array of Strings, one String for each path that was
 *          deleted. This is a side-effect, and might be useful for further processing.
 */
async function removeFolderContents(
  folderPath,
  patterns = [],
  monitoringFn = null
) {
  const $m = monitoringFn || function () {};
  const deletedPaths = [];

  try {
    const files = await fsp.readdir(folderPath);

    // Prepare a set of files to delete based on patterns
    const filesToDelete = new Set();

    // If patterns are provided, match files against patterns
    if (patterns && patterns.length > 0) {
      for (const pattern of patterns.filter(Boolean)) {
        const matches = glob.sync(pattern, { cwd: folderPath });
        for (const match of matches) {
          filesToDelete.add(match);
        }
      }
    } else {
      // If no patterns are provided, delete everything
      files.forEach((file) => filesToDelete.add(file));
    }

    // Delete matched files and folders
    const deletionPromises = [];
    for (const file of filesToDelete) {
      const filePath = path.join(folderPath, file);
      const stat = await fsp.lstat(filePath);

      if (stat.isDirectory()) {
        deletionPromises.push(
          fsp.rm(filePath, { recursive: true, force: true })
        );
      } else {
        deletionPromises.push(fsp.unlink(filePath));
      }

      deletedPaths.push(filePath);
      $m({
        type: "debug",
        message: `Deleted: "${filePath}"`,
      });
    }

    await Promise.all(deletionPromises);

    $m({
      type: "debug",
      message: `Done clearing (matching) content of folder "${folderPath}".`,
    });
  } catch (error) {
    $m({
      type: "error",
      message: `Error clearing folder "${folderPath}". Details: ${error.message}`,
      data: { error },
    });
  }
  return deletedPaths;
}

/**
 * Populates a template with data.
 * @param   {String} template
 *          The template string with placeholders.
 *
 * @param   {Object} data
 *          The data object with key-value pairs for placeholders.
 *
 * @param   {Function} [monitoringFn=null]
 *          Optional function to receive real-time monitoring information.
 *          Expected signature/arguments structure is:
 *          onMonitoringInfo ({type:"info|warn|error", message:"<any>"[, data : {}]});
 *
 * @return  {String}
 *          The populated template.
 */
function populateTemplate(template, data, monitoringFn = null) {
  const $m = monitoringFn || function () {};

  return template.replace(/{{(.*?)}}/g, (_, key) => {
    if (key in data) {
      return data[key];
    } else {
      $m({
        type: "warn",
        message: `Missing data for placeholder: ${key}`,
      });
      return `{{${key}}}`;
    }
  });
}

/**
 * Merges three data sets, giving precedence to the later sets.
 * Performs a shallow merge.
 * @param {Object} implicit - The implicit data set.
 * @param {Object} explicit - The explicit data set.
 * @param {Object} given - The given data set.
 * @return {Object} - The merged data set.
 */
function mergeData(implicit, explicit, given) {
  return { ...implicit, ...explicit, ...given };
}

module.exports = {
  ensureSetup,
  populateTemplate,
  mergeData,
  removeFolderContents,
  monitoringFn,
  setDebugMode,
  getAppInfo,
  getDefaultBanner
};
