export type UserDisplayData = {
  name?: string | null;
  email?: string | null;
  picture?: string | null;
};

export function getUserDisplayName(user: UserDisplayData) {
  const name = user.name?.trim();

  if (name) {
    return name;
  }

  const email = user.email?.trim();

  if (email) {
    return email.split("@")[0] || email;
  }

  return "Kullanıcı";
}

export function getUserInitial(user: UserDisplayData) {
  return getUserDisplayName(user).charAt(0).toLocaleUpperCase("tr-TR") || "K";
}
