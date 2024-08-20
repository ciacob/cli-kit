// configuration file handling
const { ensureSetup } = require("./utils");
const path = require("path");
const fs = require("fs");

/**
 * Reads a configuration file and returns the settings of the specified profile as a flat
 * object.
 * NOTES:
 * 1. Expected configuration file must be a JSON containing at least these elements:
 * {
 * 	"profiles":[
 * 		{
 * 			"name":"profile_a",
 * 			"settings":{
 * 				"key_1":"val_1",
 * 				"key_2":"val_2"
 * 			}
 * 		},
 * 		{
 * 			"name":"profile_b",
 * 			"settings":{
 * 				"key_1":"val_1",
 * 				"key_2":"val_2"
 * 			}
 * 		}
 * 	]
 * }
 *
 * 2. Only keys specified in the `dictionary` argument can be imported. Any others will be
 * skipped.
 *
 *
 * @param   {String} filePath
 *          The path to the configuration file.
 *
 * @param   {String} profileName
 *          The name of the profile to extract.
 *
 * @param   {Array} dictionary
 *          Array of objects describing the expected arguments/settings. Each object contains:
 *          - name: A print-friendly string (not used for parsing).
 *          - payload: A RegExp or string describing the argument pattern.
 *          - doc: Arbitrary documentation as a string.
 *          Examples:
 *            { name: 'Dry Run', payload: '--isDryRun', doc: 'A simple flag argument' }
 *            { name: 'Version', payload: /^--(version|v)/, doc: 'Prints app version' }
 *            { name: 'Home Directory', payload: /^--(homeDir)=(.+)/, doc: 'Sets app home' }
 *            {
 *              name: 'Parse Model',
 *              payload: /^--(parseModel)=(saasFile|raw)/,
 *              doc: 'Sets the parsing model to use; one of "saasFile" or "raw".'
 *            }
 *          IMPORTANT:
 *          (1) When using RegExp as payload, there must be at least one, and no more than two
 *              groups in the pattern; the first group must capture the argument name, and the
 *              second, if available, must capture the argument value.
 *          (2) If there is only one group, the value of the argument will be `true` (i.e., we
 *              will consider the argument to be a flag).
 *          (3) If a RegExp payload was used to specify both long and abridged names for an
 *              argument, e.g., /^--(version|v)/, only the long form of the argument will be
 *              used to represent the argument within the returned Object, regardless of the
 *              form used when executing the program.
 *
 * @param   {Function} [monitoringFn=null]
 *          A function to receive real-time monitoring information. Expected
 *          signature/arguments structure is: onMonitoringInfo
 *          ({type:"info|warn|error|debug", message:"<any>"[, data : {}]});
 *
 * @return  {Object|null}
 *          The settings of the specified profile as a flat object, or null if no match.
 */
function getConfigData(filePath, profileName, dictionary, monitoringFn = null) {
  const $m = monitoringFn || function () {};

  try {
    const fileContent = fs.readFileSync(filePath, "utf8");
    const configData = JSON.parse(fileContent);
    if (!configData.profiles || !Array.isArray(configData.profiles)) {
      $m({
        type: "error",
        message: `Invalid configuration structure in file: ${filePath}`,
      });
      return null;
    }
    const profile = configData.profiles.find((p) => p.name === profileName);
    if (!profile) {
      $m({
        type: profileName === "default" ? "debug" : "warn",
        message: `Profile "${profileName}" not found in configuration file: ${filePath}`,
      });
      return null;
    }

    const settings = profile.settings || {};
    const result = {};

    for (const [key, value] of Object.entries(settings)) {
      const matchingArg = dictionary.find(({ payload }) => {
        if (typeof payload === "string") {
          return payload === `--${key}`;
        } else if (payload instanceof RegExp) {
          const match = `--${key}`.match(payload);
          return match && match[1] === key;
        }
        return false;
      });

      if (!matchingArg) {
        $m({
          type: "warn",
          message: `Ignoring unknown setting "${key}" in profile "${profileName}".`,
        });
        continue; // Skip setting unknown keys
      } else if (typeof value === "string" && value.trim() === "") {
        $m({
          type: "debug",
          message: `Ignoring empty "${key}" of the "${profileName}" profile.`,
        });
        continue; // Skip setting empty strings
      } else if (
        matchingArg.payload instanceof RegExp &&
        matchingArg.payload.source.includes("|")
      ) {
        const acceptedValues = matchingArg.payload.source
          .match(/\(([^)]+)\)/)[1]
          .split("|");
        if (!acceptedValues.includes(value)) {
          $m({
            type: "warn",
            message: `Invalid value for "${key}" in profile "${profileName}". Expected one of: ${acceptedValues.join(
              ", "
            )}. Received: "${value}".`,
          });
          continue; // Skip setting invalid enumerated values
        }
      }

      result[key] = value; // Only set valid and non-empty values
    }

    return result;
  } catch (error) {
    const isFileMissing = error.code === "ENOENT";
    $m({
      type: isFileMissing ? "warn" : "error",
      message: `Error reading configuration file. Details: ${error.message}`,
      data: isFileMissing ? null : { error },
    });
    return null;
  }
}

/**
 * Creates a configuration file at a given path, validating the provided template, 
 * and populating it with data where necessary. If the provided template is invalid, 
 * empty, or does not meet the minimum required structure, a default configuration
 * structure is used.
 * 
 * NOTE: this function never throws. If any file system operations fail, the error
 * will be caught and logged through the given `monitoringFn`, if any.
 *
 * @param   {String} filePath
 *          The absolute path of the configuration file to create.
 *
 * @param   {String} template
 *          A JSON string representing the template for the configuration file. 
 *          This string can include placeholders in the format {{myVarName}}. 
 *          If the template is not valid JSON, or if it lacks the necessary structure, 
 *          a default configuration structure will be used instead.
 *
 * @param   {Object} templateData
 *          An object containing data to replace the placeholders within the template. 
 *          For example: { myVarName: "Hello world!" }. All matching placeholders 
 *          will be replaced with the corresponding values from this object.
 *
 * @param   {Function} [monitoringFn=null]
 *          An optional function to receive real-time monitoring information. 
 *          The function should expect an object with the structure:
 *          onMonitoringInfo({type: "info|warn|error", message: "<any>"[, data: {}]}).
 */

function initializeConfig(
  filePath,
  template,
  templateData,
  monitoringFn = null
) {
  const $m = monitoringFn || function () {};

  // Default structure for a valid configuration file
  const defaultConfigStructure = {
    profiles: [
      {
        name: "default_profile",
        settings: {
          key_1: "default_value_1",
          key_2: "default_value_2",
        },
      },
    ],
  };

  try {
    // Step 1: Validate if the template is a valid JSON string
    let parsedTemplate;
    try {
      parsedTemplate = JSON.parse(template);
    } catch (parseError) {
      $m({
        type: "warn",
        message: `Invalid JSON provided in template. Reverting to default configuration structure.`,
      });
      parsedTemplate = defaultConfigStructure;
    }

    // If the parsedTemplate is null or any falsy value, use the default config structure
    if (!parsedTemplate) {
      $m({
        type: "warn",
        message: `Provided template was empty or invalid. Using default configuration structure.`,
      });
      parsedTemplate = defaultConfigStructure;
    }

    // Step 2: Validate the `profiles` array structure
    if (
      !Array.isArray(parsedTemplate.profiles) ||
      parsedTemplate.profiles.length === 0
    ) {
      $m({
        type: "warn",
        message: `Invalid or missing "profiles" array in template. Injecting default profiles structure.`,
      });
      parsedTemplate.profiles = defaultConfigStructure.profiles;
    } else {
      parsedTemplate.profiles = parsedTemplate.profiles.map((profile) => {
        if (
          typeof profile.name !== "string" ||
          typeof profile.settings !== "object" ||
          Array.isArray(profile.settings) ||
          profile.settings === null
        ) {
          $m({
            type: "warn",
            message: `Invalid profile detected. Ensuring valid "name" and "settings" in the profile.`,
          });
          return {
            name: profile.name || "default_profile",
            settings: profile.settings || {},
          };
        }
        return profile;
      });
    }

    // Reconvert the validated structure back to a JSON string for writing
    const finalTemplate = JSON.stringify(parsedTemplate, null, 2);

    // Proceed with the file creation using the ensureSetup utility
    const homeDir = path.dirname(filePath);
    const fileName = path.basename(filePath);

    ensureSetup(
      homeDir,
      {
        content: [
          {
            type: "file",
            path: fileName,
            template: finalTemplate,
            data: templateData,
          },
        ],
      },
      $m
    );

    $m({
      type: "info",
      message: `Configuration file "${filePath}" created successfully.`,
    });
  } catch (error) {
    $m({
      type: "error",
      message: `Error initializing configuration file "${filePath}".`,
      data: { error },
    });
  }
}

module.exports = {
  getConfigData,
  initializeConfig,
};
