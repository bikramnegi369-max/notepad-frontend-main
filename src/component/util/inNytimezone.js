
export const dateInNY = (utcDate) => {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        year: "numeric"
    }).format(new Date(utcDate));
  };

export const timeInNY = (utcDate) => {
  return new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
}).format(new Date(utcDate));
};