import React, { FC, useEffect } from "react";
import getConfig from "next/config";

import showRecaptcha from "../helpers/recaptcha";
import { useStoreState } from "../store";
import { ColCenter } from "./Layout";
import ReCaptcha from "./ReCaptcha";
import ALink from "./ALink";
import Text from "./Text";

const { publicRuntimeConfig } = getConfig();

const Footer: FC = () => {
  const { isAuthenticated } = useStoreState(s => s.auth);

  useEffect(() => {
    showRecaptcha();
  }, []);

  return (
    <ColCenter
      as="footer"
      width={1}
      backgroundColor="white"
      p={isAuthenticated ? 2 : 24}
    >
      {!isAuthenticated && <ReCaptcha />}
      <Text fontSize={[12, 13]} py={2}>
      Сделано с любовью {" "}
        <ALink href="//thedevs.network/" title="The Devs">
          The Devs
        </ALink>
        .{" | "}
        <ALink
          href="https://www.samgups.ru"
          title="СамГУПС"
          target="_blank"
        >
          СамГУПС
        </ALink>
        {" | "}
        <ALink href="/terms" title="Условия использования">
          Условия использования
        </ALink>
        {" | "}
        <ALink href="/report" title="Сообщить о нарушении">
          Сообщить о нарушении
        </ALink>
        {publicRuntimeConfig.CONTACT_EMAIL && (
          <>
            {" | "}
            <ALink
              href={`mailto:${publicRuntimeConfig.CONTACT_EMAIL}`}
              title="Связаться с нами"
            >
              Связаться с нами
            </ALink>
          </>
        )}
        .
      </Text>
    </ColCenter>
  );
};

export default Footer;
