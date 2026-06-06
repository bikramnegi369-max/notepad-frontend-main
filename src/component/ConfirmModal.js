import React, { useState } from 'react';
import Modal from 'react-modal';

const SaveConfirmationModal = ({ isOpen, onSave, onCancel }) => {
  return (
    <Modal isOpen={isOpen}>
      <h2>Do you want to save changes before leaving?</h2>
      <button onClick={onSave}>Save</button>
      <button onClick={onCancel}>Cancel</button>
    </Modal>
  );
};

export default SaveConfirmationModal;
