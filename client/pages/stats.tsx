import { Box, Flex } from "reflexbox/styled-components";
import React, { useState, useEffect } from "react";
import formatDate from "date-fns/format";
import { NextPage } from "next";
import Link from "next/link";
import axios from "axios";

import Text, { H1, H2, H4, Span } from "../components/Text";
import { getAxiosConfig, removeProtocol } from "../utils";
import { Button, NavButton } from "../components/Button";
import { Col, RowCenterV } from "../components/Layout";
import { Area, Bar, Pie, Map } from "../components/Charts";
import PageLoading from "../components/PageLoading";
import AppWrapper from "../components/AppWrapper";
import Divider from "../components/Divider";
import { APIv2, Colors } from "../consts";
import { useStoreState } from "../store";
import ALink from "../components/ALink";
import Icon from "../components/Icon";

interface Props {
  id?: string;
}

const StatsPage: NextPage<Props> = ({ id }) => {
  const { isAuthenticated } = useStoreState(s => s.auth);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [data, setData] = useState();
  const [period, setPeriod] = useState("lastDay");

  const stats = data && data[period];

  useEffect(() => {
    if (!id || !isAuthenticated) return;
    axios
      .get(`${APIv2.Links}/${id}/stats`, getAxiosConfig())
      .then(({ data }) => {
        setLoading(false);
        setError(!data);
        setData(data);
      })
      .catch(() => {
        setLoading(false);
        setError(true);
      });
  }, []);

  let errorMessage;

  if (!isAuthenticated) {
    errorMessage = (
      <Flex mt={3}>
        <Icon name="x" size={32} mr={3} stroke={Colors.TrashIcon} />
        <H2>Вам необходимо войти в систему, чтобы просмотреть статистику.</H2>
      </Flex>
    );
  }

  if (!id || error) {
    errorMessage = (
      <Flex mt={3}>
        <Icon name="x" size={32} mr={3} stroke={Colors.TrashIcon} />
        <H2>Не удалось получить статистику.</H2>
      </Flex>
    );
  }

  const loader = loading && <PageLoading />;

  const total = stats && stats.views.reduce((sum, view) => sum + view, 0);
  
  var periodText = "все время";
  
  if (period.replace("last", "").toLocaleLowerCase() == "day")
    {var periodText = `последний день`;}
  else if (period.replace("last", "").toLocaleLowerCase() == "week")
    {var periodText = `последнюю неделю`;}
  else if (period.replace("last", "").toLocaleLowerCase() == "month")
    {var periodText = `последний месяц`;}

  return (
    <AppWrapper>
      {errorMessage ||
        loader ||
        (data && (
          <Col width={1200} maxWidth="95%" alignItems="stretch" m="40px 0">
            <Flex justifyContent="space-between" alignItems="center" mb={3}>
              <H1 fontSize={[18, 20, 24]} light>
                Статистика для:{" "}
                <ALink href={data.link} title="Короткая ссылка">
                  {removeProtocol(data.link)}
                </ALink>
              </H1>
              <Text fontSize={[13, 14]} textAlign="right">
                {data.target.length > 80
                  ? `${data.target
                      .split("")
                      .slice(0, 80)
                      .join("")}...`
                  : data.target}
              </Text>
            </Flex>
            <Col
              backgroundColor="white"
              style={{
                borderRadius: 12,
                boxShadow: "0 6px 15px hsla(200, 20%, 70%, 0.3)",
                overflow: "hidden"
              }}
            >
              <RowCenterV
                flex="1 1 auto"
                backgroundColor={Colors.TableHeadBg}
                justifyContent="space-between"
                py={[3, 3, 24]}
                px={[3, 4]}
              >
                <H4>
                  Всего переходов: <Span bold>{data.total}</Span>
                </H4>
                <Flex>
                  {[
                    ["allTime", "Все время"],
                    ["lastMonth", "Месяц"],
                    ["lastWeek", "Неделя"],
                    ["lastDay", "День"]
                  ].map(([p, n]) => (
                    <NavButton
                      ml={10}
                      disabled={p === period}
                      onClick={() => setPeriod(p as any)}
                      key={p}
                    >
                      {n}
                    </NavButton>
                  ))}
                </Flex>
              </RowCenterV>
              <Col p={[3, 4]}>
                <H2 mb={2} light>
                  <Span
                    style={{
                      borderBottom: `1px dotted ${Colors.StatsTotalUnderline}`
                    }}
                    bold
                  >
                    {total}
                  </Span>{" "}
                  отслеженных перехода(ов) за {periodText}.
                </H2>
                <Text fontSize={[13, 14]} color={Colors.StatsLastUpdateText}>
                  Последнее обновление в{" "}
                  {formatDate(new Date(data.updatedAt), "HH:mm")}
                </Text>
                <Flex width={1} mt={4}>
                  <Area data={stats.views} period={period} />
                </Flex>
                {total > 0 && (
                  <>
                    <Divider my={4} />
                    <Flex width={1}>
                      <Col flex="1 1 0">
                        <H2 mb={3} light>
                          Рефералы.
                        </H2>
                        <Pie data={stats.stats.referrer} />
                      </Col>
                      <Col flex="1 1 0">
                        <H2 mb={3} light>
                          Браузеры.
                        </H2>
                        <Bar data={stats.stats.browser} />
                      </Col>
                    </Flex>
                    <Divider my={4} />
                    <Flex width={1}>
                      <Col flex="1 1 0">
                        <H2 mb={3} light>
                          Страна.
                        </H2>
                        <Map data={stats.stats.country} />
                      </Col>
                      <Col flex="1 1 0">
                        <H2 mb={3} light>
                          Операционная система.
                        </H2>
                        <Bar data={stats.stats.os} />
                      </Col>
                    </Flex>
                  </>
                )}
              </Col>
            </Col>
            <Box alignSelf="center" my={64}>
              <Link href="/">
                <ALink href="/" title="Вернуться на главную" forButton>
                  <Button>
                    <Icon name="arrowLeft" stroke="white" mr={2} />
                    Вернуться на главную
                  </Button>
                </ALink>
              </Link>
            </Box>
          </Col>
        ))}
    </AppWrapper>
  );
};

StatsPage.getInitialProps = ({ query }) => {
  return Promise.resolve(query);
};

StatsPage.defaultProps = {
  id: ""
};

export default StatsPage;
