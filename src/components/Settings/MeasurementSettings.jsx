import React, { useState } from "react";
import MeasurementSettingsList from "./MeasurementSettingsList";
import MeasurementSettingsDetail from "./MeasurementSettingsDetail";

const MeasurementSettings = ({ onBack }) => {
  const [editingProfile, setEditingProfile] = useState(null);

  if (editingProfile !== null) {
    return (
      <MeasurementSettingsDetail
        initialProfile={editingProfile}
        onBack={() => setEditingProfile(null)}
      />
    );
  }

  return (
    <MeasurementSettingsList
      onBack={onBack}
      onEdit={(profile) => setEditingProfile(profile ?? {})}
    />
  );
};

export default MeasurementSettings;
