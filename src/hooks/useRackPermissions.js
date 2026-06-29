export const isAdminAssignmentValid = (userData) => {
    if (!userData?.isAdminAssigned) return false;
    if (!userData?.adminAssignFrom || !userData?.adminAssignTo) return false;

    const today = new Date();
    const from = new Date(userData.adminAssignFrom);
    const to = new Date(userData.adminAssignTo);

    return today >= from && today <= to;
};

export const isPrivilegedUser = (userData) =>
    [
        "Admin",
        "Super Admin"
    ].includes(userData?.role) ||
    [
        "Vertiv CIH",
        "Vertiv ZM"
    ].includes(userData?.designation) ||
    isAdminAssignmentValid(userData);
