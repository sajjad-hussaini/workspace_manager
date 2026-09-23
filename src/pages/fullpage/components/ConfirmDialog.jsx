export default function ConfirmDialog({ title, message, onCancel, onConfirm }) {
  return (
    <div className="dialog-backdrop" onClick={onCancel} role="presentation">
      <section
        className="dialog"
        onClick={(event) => event.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <h2 className="dialog-title" id="confirm-dialog-title">{title}</h2>
        <p className="dialog-message">{message}</p>
        <div className="dialog-actions">
          <button className="btn" onClick={onCancel} type="button">
            Cancel
          </button>
          <button
            className="btn"
            style={{ background: "var(--danger)", borderColor: "var(--danger)", color: "#fff", fontWeight: 700 }}
            onClick={onConfirm}
            type="button"
          >
            Delete
          </button>
        </div>
      </section>
    </div>
  );
}
