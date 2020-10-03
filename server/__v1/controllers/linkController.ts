import bcrypt from "bcryptjs";
import dns from "dns";
import { Handler } from "express";
import isbot from "isbot";
import generate from "nanoid/generate";
import ua from "universal-analytics";
import URL from "url";
import urlRegex from "url-regex";
import { promisify } from "util";
import { deleteDomain, getDomain, setDomain } from "../db/domain";
import { addIP } from "../db/ip";
import env from "../../env";
import {
  banLink,
  createShortLink,
  deleteLink,
  findLink,
  getLinks,
  getStats,
  getUserLinksCount
} from "../db/link";
import transporter from "../../mail/mail";
import * as redis from "../../redis";
import { addProtocol, generateShortLink, getStatsCacheTime } from "../../utils";
import {
  checkBannedDomain,
  checkBannedHost,
  cooldownCheck,
  malwareCheck,
  preservedUrls,
  urlCountsCheck
} from "./validateBodyController";
import queue from "../../queues";

const dnsLookup = promisify(dns.lookup);

const generateId = async () => {
  const address = generate(
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
    env.LINK_LENGTH
  );
  const link = await findLink({ address });
  if (!link) return address;
  return generateId();
};

export const shortener: Handler = async (req, res) => {
  try {
    const target = addProtocol(req.body.target);
    const targetDomain = URL.parse(target).hostname;

    const queries = await Promise.all([
      env.GOOGLE_SAFE_BROWSING_KEY && cooldownCheck(req.user),
      env.GOOGLE_SAFE_BROWSING_KEY && malwareCheck(req.user, req.body.target),
      req.user && urlCountsCheck(req.user),
      req.user &&
        req.body.reuse &&
        findLink({
          target,
          user_id: req.user.id
        }),
      req.user &&
        req.body.customurl &&
        findLink({
          address: req.body.customurl,
          domain_id: req.user.domain_id || null
        }),
      (!req.user || !req.body.customurl) && generateId(),
      checkBannedDomain(targetDomain),
      checkBannedHost(targetDomain)
    ]);

    // if "reuse" is true, try to return
    // the existent URL without creating one
    if (queries[3]) {
      const { domain_id: d, user_id: u, ...link } = queries[3];
      const shortLink = generateShortLink(link.address, req.user.domain);
      const data = {
        ...link,
        id: link.address,
        password: !!link.password,
        reuse: true,
        shortLink,
        shortUrl: shortLink
      };
      return res.json(data);
    }

    // Check if custom link already exists
    if (queries[4]) {
      throw new Error("Этот адрес уже используется.");
    }

    // Create new link
    const address = (req.user && req.body.customurl) || queries[5];
    const link = await createShortLink(
      {
        ...req.body,
        address,
        target
      },
      req.user
    );
    if (!req.user && env.NON_USER_COOLDOWN) {
      addIP(req.realIP);
    }

    return res.json({ ...link, id: link.address });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

export const goToLink: Handler = async (req, res, next) => {
  const { host } = req.headers;
  const reqestedId = req.params.id || req.body.id;
  const address = reqestedId.replace("+", "");
  const customDomain = host !== env.DEFAULT_DOMAIN && host;
  const isBot = isbot(req.headers["user-agent"]);

  let domain;
  if (customDomain) {
    domain = await getDomain({ address: customDomain });
  }

  const link = await findLink({ address, domain_id: domain && domain.id });

  if (!link) {
    if (host !== env.DEFAULT_DOMAIN) {
      if (!domain || !domain.homepage) return next();
      return res.redirect(301, domain.homepage);
    }
    return next();
  }

  if (link.banned) {
    return res.redirect("/banned");
  }

  const doesRequestInfo = /.*\+$/gi.test(reqestedId);
  if (doesRequestInfo && !link.password) {
    req.linkTarget = link.target;
    req.pageType = "info";
    return next();
  }

  if (link.password && !req.body.password) {
    req.protectedLink = address;
    req.pageType = "password";
    return next();
  }

  if (link.password) {
    const isMatch = await bcrypt.compare(req.body.password, link.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Пароль неверный" });
    }
    if (link.user_id && !isBot) {
      queue.visit.add({
        headers: req.headers,
        realIP: req.realIP,
        referrer: req.get("Referrer"),
        link,
        customDomain
      });
    }
    return res.status(200).json({ target: link.target });
  }

  if (link.user_id && !isBot) {
    queue.visit.add({
      headers: req.headers,
      realIP: req.realIP,
      referrer: req.get("Referrer"),
      link,
      customDomain
    });
  }

  if (env.GOOGLE_ANALYTICS_UNIVERSAL && !isBot) {
    const visitor = ua(env.GOOGLE_ANALYTICS_UNIVERSAL);
    visitor
      .pageview({
        dp: `/${address}`,
        ua: req.headers["user-agent"],
        uip: req.realIP,
        aip: 1
      })
      .send();
  }

  return res.redirect(link.target);
};

export const getUserLinks: Handler = async (req, res) => {
  const [countAll, list] = await Promise.all([
    getUserLinksCount({ user_id: req.user.id }),
    getLinks(req.user.id, req.query)
  ]);
  return res.json({ list, countAll: parseInt(countAll) });
};

export const setCustomDomain: Handler = async (req, res) => {
  const parsed = URL.parse(req.body.customDomain);
  const customDomain = parsed.hostname || parsed.href;
  if (!customDomain)
    return res.status(400).json({ error: "Домен недействителен." });
  if (customDomain.length > 40) {
    return res
      .status(400)
      .json({ error: "Максимальная длина личного домена - 40 символов." });
  }
  if (customDomain === env.DEFAULT_DOMAIN) {
    return res.status(400).json({ error: "Вы не можете использовать домен по умолчанию." });
  }
  const isValidHomepage =
    !req.body.homepage ||
    urlRegex({ exact: true, strict: false }).test(req.body.homepage);
  if (!isValidHomepage)
    return res.status(400).json({ error: "Домашняя страница недействительна." });
  const homepage =
    req.body.homepage &&
    (URL.parse(req.body.homepage).protocol
      ? req.body.homepage
      : `http://${req.body.homepage}`);
  const matchedDomain = await getDomain({ address: customDomain });
  if (
    matchedDomain &&
    matchedDomain.user_id &&
    matchedDomain.user_id !== req.user.id
  ) {
    return res.status(400).json({
      error: "Домен уже занят. Свяжитесь с нами для организации совместной работы."
    });
  }
  const userCustomDomain = await setDomain(
    {
      address: customDomain,
      homepage
    },
    req.user,
    matchedDomain
  );
  if (userCustomDomain) {
    return res.status(201).json({
      customDomain: userCustomDomain.address,
      homepage: userCustomDomain.homepage
    });
  }
  return res.status(400).json({ error: "Не удалось установить личный домен." });
};

export const deleteCustomDomain: Handler = async (req, res) => {
  const response = await deleteDomain(req.user);
  if (response)
    return res.status(200).json({ message: "Домен успешно удален" });
  return res.status(400).json({ error: "Не удалось удалить личный домен." });
};

export const customDomainRedirection: Handler = async (req, res, next) => {
  const { headers, path } = req;
  if (
    headers.host !== env.DEFAULT_DOMAIN &&
    (path === "/" ||
      preservedUrls
        .filter(l => l !== "url-password")
        .some(item => item === path.replace("/", "")))
  ) {
    const domain = await getDomain({ address: headers.host });
    return res.redirect(
      301,
      (domain && domain.homepage) || `https://${env.DEFAULT_DOMAIN + path}`
    );
  }
  return next();
};

export const deleteUserLink: Handler = async (req, res) => {
  const { id, domain } = req.body;

  if (!id) {
    return res.status(400).json({ error: "Идентификатор не указан." });
  }

  const response = await deleteLink({
    address: id,
    domain: !domain || domain === env.DEFAULT_DOMAIN ? null : domain,
    user_id: req.user.id
  });

  if (response) {
    return res.status(200).json({ message: "Короткая ссылка успешно удалена" });
  }

  return res.status(400).json({ error: "Не удалось удалить короткую ссылку." });
};

export const getLinkStats: Handler = async (req, res) => {
  if (!req.query.id) {
    return res.status(400).json({ error: "Идентификатор не указан." });
  }

  const { hostname } = URL.parse(req.query.domain);
  const hasCustomDomain = req.query.domain && hostname !== env.DEFAULT_DOMAIN;
  const customDomain = hasCustomDomain
    ? (await getDomain({ address: req.query.domain })) || ({ id: -1 } as Domain)
    : ({} as Domain);

  const redisKey = req.query.id + (customDomain.address || "") + req.user.email;
  const cached = await redis.get(redisKey);
  if (cached) return res.status(200).json(JSON.parse(cached));

  const link = await findLink({
    address: req.query.id,
    domain_id: hasCustomDomain ? customDomain.id : null,
    user_id: req.user && req.user.id
  });

  if (!link) {
    return res.status(400).json({ error: "Не удалось найти короткую ссылку." });
  }

  const stats = await getStats(link, customDomain);

  if (!stats) {
    return res
      .status(400)
      .json({ error: "Не удалось получить статистику по коротким ссылкам." });
  }

  const cacheTime = getStatsCacheTime(0);
  redis.set(redisKey, JSON.stringify(stats), "EX", cacheTime);
  return res.status(200).json(stats);
};

export const reportLink: Handler = async (req, res) => {
  if (!req.body.link) {
    return res.status(400).json({ error: "URL не указан." });
  }

  const { hostname } = URL.parse(req.body.link);
  if (hostname !== env.DEFAULT_DOMAIN) {
    return res.status(400).json({
      error: `Вы можете отправить жалобу только на ссылку в домене ${env.DEFAULT_DOMAIN}`
    });
  }

  const mail = await transporter.sendMail({
    from: env.MAIL_FROM || env.MAIL_USER,
    to: env.REPORT_MAIL,
    subject: "[REPORT]",
    text: req.body.link,
    html: req.body.link
  });
  if (mail.accepted.length) {
    return res
      .status(200)
      .json({ message: "Спасибо за отчет, в ближайшее время мы примем меры." });
  }
  return res
    .status(400)
    .json({ error: "Не удалось отправить отчет. Попробуйте позже." });
};

export const ban: Handler = async (req, res) => {
  if (!req.body.id)
    return res.status(400).json({ error: "Идентификатор не указан." });

  const link = await findLink({ address: req.body.id, domain_id: null });

  if (!link) return res.status(400).json({ error: "Ссылка не существует." });

  if (link.banned) {
    return res.status(200).json({ message: "Ссылка уже заблокирована." });
  }

  const domain = URL.parse(link.target).hostname;

  let host;
  if (req.body.host) {
    try {
      const dnsRes = await dnsLookup(domain);
      host = dnsRes && dnsRes.address;
    } catch (error) {
      host = null;
    }
  }

  await banLink({
    adminId: req.user.id,
    domain,
    host,
    address: req.body.id,
    banUser: !!req.body.user
  });

  return res.status(200).json({ message: "Ссылка успешно заблокирована" });
};
