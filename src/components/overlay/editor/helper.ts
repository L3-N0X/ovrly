export const handleValueChange = (obj: object, path: string, value: unknown) => {
  const keys = path.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (current[keys[i]] === undefined) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
  return obj;
};
