"use client";
import { createContext, useContext, useState } from "react";
import { Notice } from "./ui";

const Feedback = createContext<(text: string) => void>(() => {});
export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [success, setSuccess] = useState("");
  return (
    <Feedback.Provider value={setSuccess}>
      {success && (
        <div className="row between">
          <Notice success={success} />
          <button
            type="button"
            className="text-button"
            onClick={() => setSuccess("")}
          >
            Dismiss notification
          </button>
        </div>
      )}
      {children}
    </Feedback.Provider>
  );
}
export function useFeedback() {
  return useContext(Feedback);
}
