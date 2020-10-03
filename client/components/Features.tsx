import React from "react";
import styled from "styled-components";
import { Flex } from "reflexbox/styled-components";

import FeaturesItem from "./FeaturesItem";
import { ColCenterH } from "./Layout";
import { Colors } from "../consts";
import Text, { H3 } from "./Text";

const Features = () => (
  <ColCenterH
    width={1}
    flex="0 0 auto"
    py={[64, 100]}
    backgroundColor={Colors.FeaturesBg}
  >
    <H3 fontSize={[26, 28]} mb={72} light>
      Новейшие особенности.
    </H3>
    <Flex
      width={1200}
      maxWidth="100%"
      flex="1 1 auto"
      justifyContent="center"
      flexWrap={["wrap", "wrap", "wrap", "nowrap"]}
    >
      <FeaturesItem title="Управление ссылками" icon="edit">
        Создавайте, защищайте, удаляйте свои ссылки и отслеживайте их 
        с помощью подробной статистики.
      </FeaturesItem>
      <FeaturesItem title="Свой домен" icon="shuffle">
        Используйте собственные домены для ваших ссылок. Добавляйте или 
        удаляйте их бесплатно.
      </FeaturesItem>
      <FeaturesItem title="API" icon="zap">
        Используйте предоставленный API для создания, удаления и получения 
        URL-адресов из любого места.
      </FeaturesItem>
      <FeaturesItem title="Свободный и открытый код" icon="heart">
        Полностью бесплатный и открытый исходный код. Вы можете разместить 
        его на своем собственном сервере.
      </FeaturesItem>
    </Flex>
  </ColCenterH>
);

export default Features;
