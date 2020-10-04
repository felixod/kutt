import getConfig from "next/config";
import Link from "next/link";
import React from "react";

import AppWrapper from "../components/AppWrapper";
import { H2, H4, Span } from "../components/Text";
import Footer from "../components/Footer";
import ALink from "../components/ALink";
import { Col } from "../components/Layout";

const { publicRuntimeConfig } = getConfig();

const BannedPage = () => {
  return (
    <AppWrapper>
      <Col flex="1 1 100%" alignItems="center">
        <H2 textAlign="center" my={3} normal>
          Ссылка заблокирована и удалена из-за{" "}
          <Span style={{ borderBottom: "1px dotted rgba(0, 0, 0, 0.4)" }} bold>
            жалобы на вредоносное ПО или мошенничество
          </Span>
          .
        </H2>
        <H4 textAlign="center" normal>
          Если вы заметили ссылку на вредоносное ПО/мошенничество, сокращенную на{" "}
          {publicRuntimeConfig.SITE_NAME},{" "}
          <Link href="/report">
            <ALink title="Отправить жалобу">отправьте нам отчет</ALink>
          </Link>
          .
        </H4>
      </Col>
      <Footer />
    </AppWrapper>
  );
};

export default BannedPage;
