export const updateLocalUserData = (updatedFields = {}) => {
  const stored = localStorage.getItem("userData");
  if (!stored) return null;

  const parsed = JSON.parse(stored);
  const updatedUser = { ...parsed, ...updatedFields };

  localStorage.setItem("userData", JSON.stringify(updatedUser));
  return updatedUser;
};
