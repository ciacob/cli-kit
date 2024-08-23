// index.js
const path = require("path");
const fs = require("fs");

// This is for re-exporting
const allUtils = {
  ...require("./cli-primer_modules/argTools"),
  ...require("./cli-primer_modules/configTools"),
  ...require("./cli-primer_modules/utils"),
  ...require("./cli-primer_modules/session"),
};

// This is for convenient local usage.
const {
  mergeData,
  deepMergeData,
  monitoringFn,
  setDebugMode,
  getAppInfo,
  getUserHomeDirectory,
  getDefaultBanner,
  ensureSetup,
} = require("./cli-primer_modules/utils");
const { getArguments, getHelp } = require("./cli-primer_modules/argTools");
const {
  getConfigData,
  initializeConfig,
} = require("./cli-primer_modules/configTools");
const {
  canOpenSession,
  openSession,
  closeSession,
} = require("./cli-primer_modules/session");

/**
 * Convenience entry point to set up cli-primer, wrap it around your main application logic, and
 * execute it, in one go.
 *
 * NOTE: if you use `wrapAndRun` you can still access any of the individual utils functions defined
 * in the other modules, as needed. This function does not rule them out, and is here just for your
 * convenience. You can choose not to use `wrapAndRun` at all, and instead employ cli-primer tools
 * in your own style.
 *
 * @param   {Object} setupData
 *          An Object that helps tailoring the `cli-primer` package utilities to your application
 *          needs. Expected structure is:
 *            {
 *              // Whether to include "debug" messages in console output; applies to default
 *              // monitoring function only.
 *              showDebugMessages: false,
 *
 *              // Whether you need support for an `output directory`, useful if your application
 *              // is meant to produce local content to be stored on disk.
 *              useOutputDir: false,
 *
 *              // Whether to employ the basic session control cli-primer provides; useful if your
 *              // app involves lengthy operations that would suffer from execution overlapping.
 *              useSessionControl: false,
 *
 *              // Whether to employ the configuration file system provided by cli-primer. This is
 *              // a home directory based config file with support for profiles and data validation.
 *              useConfig: false,
 *
 *              // Whether to employ the `--help` argument the cli-primer provides. Giving that at
 *              // app run will display info about all available arguments and exit early.
 *              useHelp: false,
 *
 *              // Array ob Object, with each Object describing a known command line argument. See
 *              // documentation of function `getArguments` in module `utils.js` for details.
 *              argsDictionary: [],
 *
 *              // Key-value pairs to act as absolute defaults for any of the known arguments. These
 *              // defaults apply when neither config file nor command line provide any overrides.
 *              intrinsicDefaults: {},
 *
 *              // A template to use when `useConfig` is `true`. Must be valid JSON, and will be
 *              // injected with a `profiles` section for you. You can use placeholders, e.g.,
 *              // "{{name}}" would resolve to the app name, as defined in the `package.json`.
 *              // See `getAppInfo` in `utils.js` for available app placeholders and `initializeConfig`
 *              // in `configTools.js` for default configuration file details.
 *              configTemplate: "",
 *
 *              // Object describing an initial files and folders structure to be created for you in
 *              // the output directory, used if `useOutputDir` is true. See `ensureSetup` in `utils.js`
 *              // for the exact format.
 *              outputDirBlueprint: {},
 *            }
 *
 *
 * @param   {Function} mainFn
 *          Mandatory; a function that executes your application code, i.e., the main entry point
 *          into your logic. It must have the signature:
 *            `Number myMainFn (inputData, utils, monitoringFn)`
 *
 *          where `inputData` is an Object with all input gathered via configuration file and/or
 *          command line arguments, and `utils` is an Object providing convenient access to all
 *          utility functions defined by the cli-primer package. As for `monitoringFn`, it receives
 *          the monitoring function in use, either the default one, or provided by you via
 *          `userMonitoringFn` (see next).
 *
 *          You are expected to return a Number out of your `mainFn`: `0` for normal exit,  `1` for
 *          early, expected exit, and `2` for early, unexpected exit (aka, an error occurred). This
 *          value will be picked-up and returned by `wrapAndRun`, for you to use.
 *
 *          Note that your `mainFn` can also return a Promise that resolves to these numbers, this is
 *          supported as well.
 *
 * @param   {Function} cleanupFn
 *          Optional; a function to be called when application is about to exit as a result of
 *          SIGINT or SIGTERM. It must have the signature:
 *            `onCleanup (inputData, utils, monitoringFn)`
 *
 *          where `inputData` is an Object with all input gathered via configuration file and/or
 *          command line arguments, and `utils` is an Object providing convenient access to all
 *          utility functions defined by the cli-primer package. As for `monitoringFn`, it receives
 *          the monitoring function in use, either the default one, or provided by you via
 *          `userMonitoringFn` (see next).
 *
 * @param   {Function} userMonitoringFn
 *          Optional function to receive real-time monitoring information. If not provided, the
 *          `monitoringFn` function defined in the `utils.js` module will be used. For details,
 *          see its own documentation there.
 *
 * @returns {Promise<Number>} Returns a Promise that resolves to:
 *          - `0`: To suggest that the program completed normally.
 *          - `1`: To suggest that the program had an expected early exit (e.g., the `--help` 
 *                 argument was given, which printed documentation and halted execution).
 *          - `2`: To suggest the program exited due to an error.
 *      
 *          NOTES:
 *          1. If no errors prevent `cli-primer` from running the `mainFn` you provide, then the
 *             Promise will resolve to whatever value your `mainFn` returns. You can follow the same
 *             convention, or you can devise your own.
 *          2. `cli-primer` itself does not call `process.exit`, but it is probably a good idea that
 *             you call it, passing it the return value of `wrapAndRun`, as these (0, 1, 2) are some
 *             pretty common exit values, and you will gain interoperability by doing so (you will be
 *             able to run your application from, e.g., bash scripts, which will know for sure whether
 *             your application terminated normally or not). `cli-primer` does not call `process.exit`
 *             itself to give you flexibility. For example, if you intend to keep a service running in
 *             your application, you could return a different value (e.g., `3`) from your `mainFn` and
 *             handle that case separately in your code (e.g., choose NOT to call `process.exit()`).
 */
async function wrapAndRun(
  setupData = {},
  mainFn,
  cleanupFn = null,
  userMonitoringFn = null
) {
  return new Promise(async (resolve, reject) => {
    const defaults = {
      showDebugMessages: false,
      useOutputDir: false,
      useSessionControl: false,
      useConfig: false,
      useHelp: false,
      argsDictionary: [],
      intrinsicDefaults: {},
      configTemplate: "",
      outputDirBlueprint: {},
    };

    // Merge defaultSetupData with user-provided setupData
    const finalSetupData = deepMergeData(defaults, setupData);

    // Setup monitoring function
    const $m = userMonitoringFn || monitoringFn;
    setDebugMode(finalSetupData.showDebugMessages);

    // Prepare arguments dictionary
    const argsDictionary = [...finalSetupData.argsDictionary];

    if (finalSetupData.useHelp) {
      argsDictionary.push({
        name: "Help",
        payload: /^--(help|h)$/,
        doc: "Displays information about the program's input parameters and exits.",
        mandatory: false,
      });
    }

    if (finalSetupData.useConfig) {
      argsDictionary.push(
        {
          name: "Configuration File Initialization",
          payload: /^--(init_config|ic)$/,
          doc: "Initializes an empty configuration file in the user's home directory and exits.",
          mandatory: false,
        },
        {
          name: "Configuration Profile Selection",
          payload: /^--(config_profile|cp)=(.+)$/,
          doc: "Loads default data from a configuration profile if it has been defined.",
          mandatory: false,
        }
      );
    }

    if (finalSetupData.useOutputDir) {
      argsDictionary.push({
        name: "Output directory",
        payload: /^--(output_dir|od)=(.+)$/,
        doc: "The working directory for the program. All content produced by the program will be placed in this directory. It must be an absolute and valid path to an already existing folder.",
        mandatory: true,
      });
    }

    // 1. Parse command-line arguments
    const appInfo = getAppInfo($m);
    const cmdArgs = getArguments(argsDictionary, null, $m);
    if (!cmdArgs) {
      $m({
        type: "error",
        message: `Failed reading program arguments. Run "${appInfo.name} --h" for documentation.`,
      });
      resolve(2); // Error exit
      return;
    }

    // 2. Handle --help
    if (finalSetupData.useHelp && cmdArgs.help) {
      console.log(
        `${getDefaultBanner(appInfo)}\n${getHelp(argsDictionary, $m)}`
      );
      return;
    }

    // 3. Handle --init_config
    const configFilePath = path.join(
      getUserHomeDirectory(),
      `${appInfo.appPathName}.config`
    );
    if (finalSetupData.useConfig && cmdArgs.init_config) {
      initializeConfig(
        configFilePath,
        finalSetupData.configTemplate,
        appInfo,
        $m
      );
      $m({
        type: "debug",
        message: `Configuration file initialized at ${configFilePath}`,
      });
      resolve(1); // Early exit for config initialization
      return;
    }

    // 4. Load default profile
    const defaultProfileData = finalSetupData.useConfig
      ? getConfigData(configFilePath, "default", argsDictionary, $m)
      : {};

    // 5. Load specified profile if any
    const specifiedProfileData =
      finalSetupData.useConfig && cmdArgs.config_profile
        ? getConfigData(
            configFilePath,
            cmdArgs.config_profile,
            argsDictionary,
            $m
          )
        : {};

    // 6. Merge all data sources
    const mergedData = mergeData(
      finalSetupData.intrinsicDefaults,
      defaultProfileData,
      specifiedProfileData,
      cmdArgs
    );

    // 7. Validate mandatory arguments
    for (const { payload, mandatory } of argsDictionary) {
      if (mandatory) {
        const argName = payload.source.match(/\(([^)]+)\)/)[1].split("|")[0];
        if (!mergedData[argName]) {
          $m({
            type: "error",
            message: `Mandatory argument "${argName}" is missing.`,
          });
          resolve(2);
          return;
        }
      }
    }

    // 8. Ensure the output directory is given and valid
    if (finalSetupData.useOutputDir) {
      const outputDir = mergedData.output_dir;
      if (
        !outputDir ||
        !fs.existsSync(outputDir) ||
        !fs.lstatSync(outputDir).isDirectory()
      ) {
        $m({
          type: "error",
          message: `Provided output directory "${outputDir}" is invalid.`,
        });
        resolve(2);
        return;
      }
    }

    // 9. Check for session control
    if (finalSetupData.useOutputDir && finalSetupData.useSessionControl) {
      const outputDir = mergedData.output_dir;
      if (!canOpenSession(outputDir)) {
        $m({
          type: "error",
          message: `Session is already active for the directory: ${outputDir}`,
        });
        resolve(2);
        return;
      }
      openSession(outputDir);
    }

    // 10. Ensure the output directory structure
    if (finalSetupData.useOutputDir) {
      ensureSetup(mergedData.output_dir, finalSetupData.outputDirBlueprint, $m);
    }

    // 11. Execute the main business logic
    let mainExitVal = 0;
    try {
      mainExitVal = await mainFn(mergedData, allUtils, $m);
    } catch (error) {
      $m({
        type: "error",
        message: `Error in main function execution: ${error.message}`,
        data: { error },
      });
      mainExitVal = 2;
    } finally {
      if (finalSetupData.useOutputDir && finalSetupData.useSessionControl) {
        closeSession(mergedData.output_dir);
      }
      resolve(mainExitVal);
    }

    // 12. HANDLE CLEANUP ON EXIT
    // Define generic listener.
    const onExit = (signalType, inputData, utils, monitoringFn) => {
      monitoringFn({
        type: "debug",
        message: `Exiting by signal ${signalType}.`,
      });

      if (finalSetupData.useOutputDir && finalSetupData.useSessionControl) {
        monitoringFn({
          type: "debug",
          message: `Session control is employed. Cleaning up before exit.`,
        });
        closeSession(inputData.output_dir);
      }
      if (cleanupFn) {
        cleanupFn(inputData, utils, monitoringFn);
      }
    };

    // Factory to build a closure out of the generic listener
    function createExitHandler(signalType, context, monitoringFn) {
      return () => onExit(signalType, context, monitoringFn);
    }

    // Hook up listeners.
    process.on("SIGINT", createExitHandler("SIGINT", mergedData, allUtils, $m));
    process.on(
      "SIGTERM",
      createExitHandler("SIGTERM", mergedData, allUtils, $m)
    );

    // ...Promise function ends here.
  });
}

// Re-exporting all the functions for convenient, individual access, if needed.
module.exports = {
  wrapAndRun,
  ...allUtils,
};
