import React from "react";
import "../assets/Modal.css";

const Modal = ({ isOpen, isMinimized, onMinimize, children }) => {
  if (!isOpen) return null;

  return (
    <div className={`modal-overlay ${isMinimized ? "minimized" : ""}`}>
      <div className={`modal-container ${isMinimized ? "minimized" : ""}`}>
        
        <div className="modal-header">
          <button onClick={onMinimize}>
            {isMinimized ? "🔼 Restore" : "➖ Minimize"}
          </button>
        </div>

        {!isMinimized && (
          <div className="modal-body">
            {children}
          </div>
        )}

      </div>
    </div>
  );
};

export default Modal;

