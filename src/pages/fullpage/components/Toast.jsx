import { useEffect } from "react";
import { Icon } from "./Icons";

export default function Toast({ message, type = "info", onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2600);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className={`toast toast--${type}`} role={type === "error" ? "alert" : "status"}>
      {type === "error" && <Icon name="error" />}
      <span>{message}</span>
    </div>
  );
}
