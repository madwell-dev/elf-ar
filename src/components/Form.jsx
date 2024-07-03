import { useState } from "react";
import { sanitize } from "isomorphic-dompurify";
import styles from "../styles/FormStyles.module.scss";

const SubscribeForm = ({ status, message, onSubmitted }) => {
  const [error, setError] = useState(null);
  const [email, setEmail] = useState(null);

  /**
   * Handle form submit.
   *
   * @return {{value}|*|boolean|null}
   */
  const handleFormSubmit = () => {
    setError(null);

    if (!email) {
      setError("Please enter a valid email address");
      return null;
    }

    const isFormValidated = onSubmitted({ EMAIL: email });

    // On success return true
    return email && email.indexOf("@") > -1 && isFormValidated;
  };

  /**
   * Handle Input Key Event.
   *
   * @param event
   */
  const handleInputKeyEvent = (event) => {
    setError(null);
    // Number 13 is the "Enter" key on the keyboard
    if (event.keyCode === 13) {
      // Cancel the default action, if needed
      event.preventDefault();
      // Trigger the button element with a click
      handleFormSubmit();
    }
  };

  /**
   * Extract message from string.
   *
   * @param {String} message
   * @return {null|*}
   */
  const getMessage = (message) => {
    if (!message) {
      return null;
    }
    const result = message?.split("-") ?? null;
    if ("0" !== result?.[0]?.trim()) {
      return sanitize(message);
    }
    const formattedMessage = result?.[1]?.trim() ?? null;
    return formattedMessage ? sanitize(formattedMessage) : null;
  };

  return (
    <div className={styles.SubscribeForm}>
      <h3 className={styles.Heading}>
        Subscribe.
      </h3>
      <div className="box">
        <input
          onChange={(event) => setEmail(event?.target?.value ?? "")}
          type="email"
          placeholder="Email Address"
          onKeyUp={(event) => handleInputKeyEvent(event)}
        />
        <button onClick={handleFormSubmit}>
          Submit
        </button>
        <div className={`${styles.Message} response $}`}>
          {"sending" === status ? <div>Wait...</div> : null}
          {"error" === status || error ? (
            <div
              className={`${styles.ErrorMessage} $}`}
              dangerouslySetInnerHTML={{ __html: error || getMessage(message) }}
            />
          ) : null}
          {"success" === status && "error" !== status && !error && (
            <div
              className={`${styles.SuccessMessage} $}`}
              dangerouslySetInnerHTML={{ __html: sanitize(message) }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default SubscribeForm;
