import subMonths from "date-fns/subMonths";
import subHours from "date-fns/subHours";
import formatDate from "date-fns/format";
import subDays from "date-fns/subDays";
import React, { FC } from "react";
import { ru } from 'date-fns/locale';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip
} from "recharts";

interface Props {
  data: number[];
  period: string;
}

const ChartArea: FC<Props> = ({ data: rawData, period }) => {
  const now = new Date();
  const getDate = index => {
    switch (period) {
      case "allTime":
        return formatDate(
          subMonths(now, rawData.length - index - 1),
          "MMM yyy", { locale: ru }
        );
      case "lastDay":
        return formatDate(subHours(now, rawData.length - index - 1), "HH:00", { locale: ru });
      case "lastMonth":
      case "lastWeek":
      default:
        return formatDate(subDays(now, rawData.length - index - 1), "MMM dd", { locale: ru });
    }
  };
  const data = rawData.map((view, index) => ({
    name: getDate(index),
    views: view
  }));

  return (
    <ResponsiveContainer
      width="100%"
      height={window.innerWidth < 468 ? 240 : 320}
    >
      <AreaChart
        data={data}
        margin={{
          top: 16,
          right: 0,
          left: 0,
          bottom: 16
        }}
      >
        <defs>
          <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00AD8E" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#00C08E" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="name" />
        <YAxis />
        <CartesianGrid strokeDasharray="1 1" />
        <Tooltip />
        <Area
          name="просмотры"
          type="monotone"
          dataKey="views"
          isAnimationActive={false}
          stroke="#00C08E"
          fillOpacity={1}
          fill="url(#colorUv)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default ChartArea;
