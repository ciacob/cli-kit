// argument parsing and help generation

/**
 * Retrieves and parses arguments, if any.
 * @param   {Array} dictionary
 *          Array of objects describing the arguments that are expected. Each object contains:
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
 * @param   {Object} defaults
 *          Optional. Object containing key-value pairs to populate the arguments repository
 *          with. These will function as defaults, in case no value will be found to overwrite
 *          them.
 *
 * @param   {Function} [monitoringFn=null]
 *          Optional function to receive real-time monitoring information.
 *          Expected signature/arguments structure is: onMonitoringInfo
 *          ({type:"info|warn|error", message:"<any>"[, data : {}]});
 *
 * @return  {Object} Key-value pairs of provided or default arguments.
 *          Returns `null` for an unmatched argument, in which case the client code should
 *          stop execution.
 */
function getArguments(dictionary, defaults = {}, monitoringFn = null) {
  const $m = monitoringFn || function () {};
  const args = process.argv.slice(2);
  const argValues = { ...defaults };
  for (const arg of args) {
    if (!!arg) {
      let matched = false;
      for (const { payload } of dictionary) {
        if (typeof payload === "string") {
          if (arg === payload) {
            const key = arg.replace(/^\W*/, "");
            argValues[key] = true;
            matched = true;
            break;
          }
        } else if (payload instanceof RegExp) {
          const match = arg.match(payload);
          if (match) {
            let argName = match[1];
            const argNameSrc = payload.source;
            const argNames = argNameSrc.match(/\(([^\)]+)\)/)[1];
            if (argNames) {
              argName = argNames.split("|").shift();
            }
            argValues[argName] = match[2] || true;
            matched = true;
            break;
          }
        }
      }
      if (!matched) {
        $m({ type: "error", message: `Unknown argument: ${arg}` });
        return null;
      }
    }
  }
  return argValues;
}

/**
 * Generates a help string based on the dictionary of arguments.
 * @param {Array} dictionary
 *        Array of objects describing the arguments. Each object contains:
 *        - name: A print-friendly string
 *        - payload: A RegExp or string describing the argument pattern
 *        - doc: Arbitrary documentation as a string
 * @param {Function} [monitoringFn=null]
 *        Optional function to receive real-time monitoring information.
 *        Expected signature/arguments structure is: onMonitoringInfo
 *        ({type:"info|warn|error", message:"<any>"[, data : {}]});
 * @return {String} A formatted help string.
 */
function getHelp(dictionary, monitoringFn = null) {
  const $m = monitoringFn || function () {};

  const REGEX_ARG_NAME = /\(([^)]+)\)/;
  const REGEX_MULTI_ALIAS = /\(([^)]+)\)/g;

  let helpString = "";

  try {
    for (const { name, payload, doc } of dictionary) {
      let formattedPayload = "";
      let acceptedValues = "";

      if (typeof payload === "string") {
        formattedPayload = payload;
      } else if (payload instanceof RegExp) {
        const argNameSrc = payload.source;
        const argNamesMatch = argNameSrc.match(REGEX_ARG_NAME);
        if (argNamesMatch) {
          const argNames = argNamesMatch[1].split("|");
          formattedPayload = `--${argNames.join(" or --")}`;
          const matchGroups = argNameSrc.match(REGEX_MULTI_ALIAS);
          if (matchGroups.length > 1) {
            formattedPayload += "=...";
            const valueMatch = matchGroups[1].match(REGEX_ARG_NAME);
            if (valueMatch && valueMatch[1].includes("|")) {
              acceptedValues = `Accepted values: ${valueMatch[1].replace(
                /\|/g,
                ", "
              )}`;
            }
          }
        } else {
          formattedPayload = payload.toString();
        }
      } else {
        $m({
          type: "error",
          message: `Invalid payload type for argument: ${name}`,
        });
        continue;
      }

      helpString += `${formattedPayload}\nName: ${name}\nDetails: ${doc}\n`;
      if (acceptedValues) {
        helpString += `${acceptedValues}\n`;
      }
      helpString += `Form: ${payload}\n\n`;
    }
  } catch (error) {
    $m({
      type: "error",
      message: `Error generating help string. Details: ${error.message}`,
      data: { error },
    });
  }

  return helpString.trim();
}

module.exports = {
    getArguments,
    getHelp,
  };