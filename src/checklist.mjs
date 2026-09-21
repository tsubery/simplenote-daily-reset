const HEADING = /^(#{1,6})[ \t]+Daily[ \t]*#*[ \t]*$/i;
const ANY_HEADING = /^(#{1,6})[ \t]+/;
const CHECKED_BOX = /^(\s*(?:[-+*]|\d+[.)])\s+\[)[xX](\])/;

/**
 * Uncheck Markdown task-list items in every section headed "Daily".
 * A Daily section ends at the next heading of the same or higher level.
 */
export function resetDailySection(content) {
  const lines = content.split('\n');
  let dailyLevel = null;
  let resetCount = 0;

  const output = lines.map((line) => {
    const heading = line.match(ANY_HEADING);

    if (heading) {
      const level = heading[1].length;
      if (dailyLevel !== null && level <= dailyLevel) dailyLevel = null;

      const daily = line.match(HEADING);
      if (daily) dailyLevel = daily[1].length;

      return line;
    }

    if (dailyLevel !== null && CHECKED_BOX.test(line)) {
      resetCount += 1;
      return line.replace(CHECKED_BOX, '$1 $2');
    }

    return line;
  });

  return { content: output.join('\n'), resetCount };
}
