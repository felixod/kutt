import { useFormState } from "react-use-form-state";
import { Flex } from "reflexbox/styled-components";
import React, { useState } from "react";
import { NextPage } from "next";
import { useRouter } from "next/router";
import axios from "axios";

import AppWrapper from "../../components/AppWrapper";
import { TextInput } from "../../components/Input";
import { Button } from "../../components/Button";
import Text, { H2 } from "../../components/Text";
import { Col } from "../../components/Layout";
import Icon from "../../components/Icon";
import { APIv2 } from "../../consts";

interface Props {
  protectedLink?: string;
}

const ProtectedPage: NextPage<Props> = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formState, { password }] = useFormState<{ password: string }>();
  const [error, setError] = useState<string>();

  const onSubmit = async e => {
    e.preventDefault();
    const { password } = formState.values;

    if (!password) {
      return setError("Пароль не должен быть пустым.");
    }

    setError("");
    setLoading(true);
    try {
      const { data } = await axios.post(
        `${APIv2.Links}/${router.query.id}/protected`,
        {
          password
        }
      );
      window.location.replace(data.target);
    } catch ({ response }) {
      setError(response.data.error);
    }
    setLoading(false);
  };

  return (
    <AppWrapper>
      {!router.query.id ? (
        <H2 my={4} light>
          404 | Ссылка не найдена.
        </H2>
      ) : (
        <Col width={500} maxWidth="97%">
          <H2 my={3} bold>
          Защищенная ссылка
          </H2>
          <Text mb={4}>Введите пароль, для перенаправления по ссылке.</Text>
          <Flex
            as="form"
            alignItems="center"
            onSubmit={onSubmit}
            style={{ position: "relative" }}
          >
            <TextInput
              {...password("password")}
              placeholder="Пароль"
              autocomplete="off"
              height={[44, 54]}
              width={[1, 1 / 2]}
              mr={3}
              autoFocus
              required
            />
            <Button type="submit" height={[40, 44]}>
              {loading && <Icon name={"spinner"} stroke="white" mr={2} />}
              Перейти
            </Button>
          </Flex>
          <Text fontSize={14} color="red" mt={3} normal>
            {error}
          </Text>
        </Col>
      )}
    </AppWrapper>
  );
};

ProtectedPage.getInitialProps = async ({ req }) => {
  return {
    protectedLink: req && (req as any).protectedLink
  };
};

export default ProtectedPage;
