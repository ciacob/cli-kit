// index.js
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

async function wrapAndRun(
  setupData = {},
  mainFn,
  cleanupFn = null,
  userMonitoringFn = null
) {
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
  const cmdArgs = getArguments(argsDictionary, null, $m);
  if (!cmdArgs) {
    return;
  }

  // 2. Handle --help
  if (finalSetupData.useHelp && cmdArgs.help) {
    console.log(getHelp(argsDictionary, $m));
    return;
  }

  // 3. Handle --init_config
  if (finalSetupData.useConfig && cmdArgs.init_config) {
    const appInfo = getAppInfo($m);
    const configFilePath = path.join(
      getUserHomeDirectory(),
      `${appInfo.appPathName}.config`
    );
    initializeConfig(
      configFilePath,
      finalSetupData.configTemplate,
      appInfo,
      $m
    );
    return;
  }

  // 4. Load default profile
  const defaultProfileData = finalSetupData.useConfig
    ? getConfigData(
        path.join(getUserHomeDirectory(), `${getAppInfo().appPathName}.config`),
        "default",
        argsDictionary,
        $m
      )
    : {};

  // 5. Load specified profile if any
  const specifiedProfileData =
    finalSetupData.useConfig && cmdArgs.config_profile
      ? getConfigData(
          path.join(
            getUserHomeDirectory(),
            `${getAppInfo().appPathName}.config`
          ),
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
    if (mandatory && !mergedData[payload.replace(/^--/, "").split("=")[0]]) {
      $m({
        type: "error",
        message: `Mandatory argument "${payload}" is missing.`,
      });
      return;
    }
  }

  // 8. Ensure the output directory is given and valid
  if (finalSetupData.useOutputDir) {
    const outputDir = mergedData.output_dir || mergedData.od;
    if (
      !outputDir ||
      !fs.existsSync(outputDir) ||
      !fs.lstatSync(outputDir).isDirectory()
    ) {
      $m({
        type: "error",
        message: "Output directory is either not provided or invalid.",
      });
      return;
    }
  }

  // 9. Check for session control
  if (finalSetupData.useSessionControl) {
    const outputDir = mergedData.output_dir || mergedData.od;
    if (!canOpenSession(outputDir)) {
      $m({
        type: "error",
        message: `Session is already active for the directory: ${outputDir}`,
      });
      return;
    }
    openSession(outputDir);
  }

  // 10. Ensure the output directory structure
  if (finalSetupData.useOutputDir) {
    const outputDir = mergedData.output_dir || mergedData.od;
    ensureSetup(outputDir, finalSetupData.outputDirBlueprint, $m);
  }

  // 11. Execute the main business logic
  try {
    await mainFn(mergedData, allUtils, $m);
  } catch (error) {
    $m({
      type: "error",
      message: `Error in main function execution: ${error.message}`,
      data: { error },
    });
  } finally {
    if (finalSetupData.useSessionControl) {
      closeSession(mergedData.output_dir || mergedData.od);
    }
  }

  // Handle cleanup on exit
  const onExit = () => {
    if (finalSetupData.useSessionControl) {
      closeSession(mergedData.output_dir || mergedData.od);
    }
    if (cleanupFn) {
      cleanupFn();
    }
  };
  process.on("SIGINT", onExit);
  process.on("SIGTERM", onExit);
}

// Re-exporting all the functions for convenient, individual access, if needed.
module.exports = {
  wrapAndRun,
  ...allUtils,
};
