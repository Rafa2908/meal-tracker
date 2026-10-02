const regex = {
  name: /^[\p{L}\p{N}](?:[\p{L}\p{N}\s'&.,()%/-]*[\p{L}\p{N}])?$/u,
};

export const nameValidator = (name) => {
  return regex.name.test(name.trim());
};

export const NotNumberSanitizer = (macros) => {
  return macros.some((macro) => isNaN(macro));
};
