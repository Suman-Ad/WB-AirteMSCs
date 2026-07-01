// src/utils/activityLogger.js

export function getChangedFields(oldData = {}, newData = {}) {
  const changes = [];

  const ignoredFields = [
    "updatedAt",
    "updatedBy",
    "activityLog",
  ];

  const keys = new Set([
    ...Object.keys(oldData),
    ...Object.keys(newData),
  ]);

  keys.forEach((field) => {
    if (ignoredFields.includes(field)) return;

    const oldValue = oldData[field];
    const newValue = newData[field];

    if (
      JSON.stringify(oldValue) !==
      JSON.stringify(newValue)
    ) {
      changes.push({
        field,
        oldValue: oldValue ?? null,
        newValue: newValue ?? null,
      });
    }
  });

  return changes;
}

export function createActivityEntry({
  action,
  user,
  oldData = {},
  newData = {},
}) {
  return {
    action,
    timestamp: new Date().toISOString(),

    user: {
      uid: user.uid,
      name: user.name,
      empId: user.empId,
      role: user.role,
    },

    changes: getChangedFields(oldData, newData),
  };
}