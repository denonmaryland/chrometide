/** Browser suites collect observations so one run can report several broken features. */
export function checkResults(results, errors) {
  console.log(JSON.stringify(results, null, 2))
  const failures = [...errors]

  function inspect(entries, prefix = "") {
    for (const [key, value] of Object.entries(entries)) {
      const name = prefix + key
      if (value === false || (typeof value === "string" && value.startsWith("FAILED "))) {
        failures.push(name + ": " + value)
      } else if (key.endsWith("Bytes") && !(value > 0)) {
        failures.push(name + ": expected a nonempty export")
      } else if (value && typeof value === "object" && !Array.isArray(value)) {
        inspect(value, name + ".")
      }
    }
  }

  inspect(results)
  if (failures.length) throw new Error(failures.join("\n"))
}
