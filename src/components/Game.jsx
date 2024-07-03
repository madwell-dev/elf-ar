import React, { useRef, useEffect } from 'react';
import MailchimpSubscribe from "react-mailchimp-subscribe";
import SubscribeForm from "./Form";

const Game = () => {
  const formRef = useRef(null);

  return (
    <div className="game">
      <div className="card form">
        <div>
          <MailchimpSubscribe
                url="https://madwell.us1.list-manage.com/subscribe/post?u=6430f277202d5d8c663d9b7b5&amp;id=796adbebbf&amp;f_id=005afee5f0"
                render={({ subscribe, status, message }) => (
                  <div>
                    <SubscribeForm
                      status={status}
                      message={message}
                      onSubmitted={(formData) => subscribe(formData)}
                    />
                  </div>
                )}
              />
        </div>
      </div>
    </div>
  );
}

export default Game;