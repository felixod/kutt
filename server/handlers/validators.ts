import { body, param } from "express-validator";
import { isAfter, subDays, subHours, addMilliseconds } from "date-fns";
import urlRegex from "url-regex";
import { promisify } from "util";
import bcrypt from "bcryptjs";
import axios from "axios";
import dns from "dns";
import URL from "url";
import ms from "ms";

import { CustomError, addProtocol } from "../utils";
import query from "../queries";
import knex from "../knex";
import env from "../env";

const dnsLookup = promisify(dns.lookup);

export const preservedUrls = [
  "login",
  "logout",
  "signup",
  "reset-password",
  "resetpassword",
  "url-password",
  "url-info",
  "settings",
  "stats",
  "verify",
  "api",
  "404",
  "static",
  "images",
  "banned",
  "terms",
  "privacy",
  "protected",
  "report",
  "pricing"
];

export const checkUser = (value, { req }) => !!req.user;

export const createLink = [
  body("target")
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage("Цель отсутствует.")
    .isString()
    .trim()
    .isLength({ min: 1, max: 2040 })
    .withMessage("Максимальная длина URL-адреса - 2040.")
    .customSanitizer(addProtocol)
    .custom(
      value =>
        urlRegex({ exact: true, strict: false }).test(value) ||
        /^(?!https?)(\w+):\/\//.test(value)
    )
    .withMessage("URL-адрес недействителен.")
    .custom(value => URL.parse(value).host !== env.DEFAULT_DOMAIN)
    .withMessage(`${env.DEFAULT_DOMAIN} URL-адреса не разрешены.`),
  body("password")
    .optional({ nullable: true, checkFalsy: true })
    .custom(checkUser)
    .withMessage("Только зарегистрированные пользователи могут использовать это поле.")
    .isString()
    .isLength({ min: 3, max: 64 })
    .withMessage("Длина пароля должна быть от 3 до 64."),
  body("customurl")
    .optional({ nullable: true, checkFalsy: true })
    .custom(checkUser)
    .withMessage("Только зарегистрированные пользователи могут использовать это поле.")
    .isString()
    .trim()
    .isLength({ min: 1, max: 64 })
    .withMessage("Длина настраиваемого URL-адреса должна быть от 1 до 64.")
    .custom(value => /^[a-zA-Z0-9-_]+$/g.test(value))
    .withMessage("Настраиваемый URL-адрес недействителен.")
    .custom(value => !preservedUrls.some(url => url.toLowerCase() === value))
    .withMessage("Вы не можете использовать этот настраиваемый URL."),
  body("reuse")
    .optional({ nullable: true })
    .custom(checkUser)
    .withMessage("Только зарегистрированные пользователи могут использовать это поле.")
    .isBoolean()
    .withMessage("Повторное использование должно быть логическим."),
  body("description")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .trim()
    .isLength({ min: 0, max: 2040 })
    .withMessage("Длина описания должна быть от 0 до 2040."),
  body("expire_in")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .trim()
    .custom(value => {
      try {
        return !!ms(value);
      } catch {
        return false;
      }
    })
    .withMessage("Неправильно указан срок действия ссылки. Примеры правильного использования: 1m, 8h, 42 days.")
    .customSanitizer(ms)
    .custom(value => value >= ms("1m"))
    .withMessage("Минимальное время истечения должно быть '1 минута'.")
    .customSanitizer(value => addMilliseconds(new Date(), value).toISOString()),
  body("domain")
    .optional({ nullable: true, checkFalsy: true })
    .custom(checkUser)
    .withMessage("Только зарегистрированные пользователи могут использовать это поле.")
    .isString()
    .withMessage("Домен должен быть строкой.")
    .customSanitizer(value => value.toLowerCase())
    .customSanitizer(value => URL.parse(value).hostname || value)
    .custom(async (address, { req }) => {
      if (address === env.DEFAULT_DOMAIN) {
        req.body.domain = null;
        return;
      }

      const domain = await query.domain.find({
        address,
        user_id: req.user.id
      });
      req.body.domain = domain || null;

      if (!domain) return Promise.reject();
    })
    .withMessage("Вы не можете использовать этот домен.")
];

export const editLink = [
  body("target")
    .optional({ checkFalsy: true, nullable: true })
    .isString()
    .trim()
    .isLength({ min: 1, max: 2040 })
    .withMessage("Максимальная длина URL-адреса - 2040.")
    .customSanitizer(addProtocol)
    .custom(
      value =>
        urlRegex({ exact: true, strict: false }).test(value) ||
        /^(?!https?)(\w+):\/\//.test(value)
    )
    .withMessage("URL-адрес недействителен.")
    .custom(value => URL.parse(value).host !== env.DEFAULT_DOMAIN)
    .withMessage(`${env.DEFAULT_DOMAIN} URL-адреса не разрешены.`),
  body("address")
    .optional({ checkFalsy: true, nullable: true })
    .isString()
    .trim()
    .isLength({ min: 1, max: 64 })
    .withMessage("Длина настраиваемого URL-адреса должна быть от 1 до 64.")
    .custom(value => /^[a-zA-Z0-9-_]+$/g.test(value))
    .withMessage("Настраиваемый URL-адрес недействителен.")
    .custom(value => !preservedUrls.some(url => url.toLowerCase() === value))
    .withMessage("Вы не можете использовать этот настраиваемый URL."),
  body("expire_in")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .trim()
    .custom(value => {
      try {
        return !!ms(value);
      } catch {
        return false;
      }
    })
    .withMessage("Неправильно указан срок действия ссылки. Примеры правильного использования: 1m, 8h, 42 days.")
    .customSanitizer(ms)
    .custom(value => value >= ms("1m"))
    .withMessage("Минимальное время истечения должно быть '1 минута'.")
    .customSanitizer(value => addMilliseconds(new Date(), value).toISOString()),
  body("description")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .trim()
    .isLength({ min: 0, max: 2040 })
    .withMessage("Длина описания должна быть от 0 до 2040."),
  param("id", "ID is invalid.")
    .exists({ checkFalsy: true, checkNull: true })
    .isLength({ min: 36, max: 36 })
];

export const redirectProtected = [
  body("password", "Password is invalid.")
    .exists({ checkFalsy: true, checkNull: true })
    .isString()
    .isLength({ min: 3, max: 64 })
    .withMessage("Длина пароля должна быть от 3 до 64."),
  param("id", "ID is invalid.")
    .exists({ checkFalsy: true, checkNull: true })
    .isLength({ min: 36, max: 36 })
];

export const addDomain = [
  body("address", "Domain is not valid")
    .exists({ checkFalsy: true, checkNull: true })
    .isLength({ min: 3, max: 64 })
    .withMessage("Длина домена должна быть от 3 до 64.")
    .trim()
    .customSanitizer(value => {
      const parsed = URL.parse(value);
      return parsed.hostname || parsed.href;
    })
    .custom(value => urlRegex({ exact: true, strict: false }).test(value))
    .custom(value => value !== env.DEFAULT_DOMAIN)
    .withMessage("Вы не можете использовать домен по умолчанию.")
    .custom(async value => {
      const domain = await query.domain.find({ address: value });
      if (domain?.user_id || domain?.banned) return Promise.reject();
    })
    .withMessage("Вы не можете добавить этот домен."),
  body("homepage")
    .optional({ checkFalsy: true, nullable: true })
    .customSanitizer(addProtocol)
    .custom(value => urlRegex({ exact: true, strict: false }).test(value))
    .withMessage("Домашняя страница недействительна.")
];

export const removeDomain = [
  param("id", "ID is invalid.")
    .exists({
      checkFalsy: true,
      checkNull: true
    })
    .isLength({ min: 36, max: 36 })
];

export const deleteLink = [
  param("id", "ID is invalid.")
    .exists({
      checkFalsy: true,
      checkNull: true
    })
    .isLength({ min: 36, max: 36 })
];

export const reportLink = [
  body("link", "No link has been provided.")
    .exists({
      checkFalsy: true,
      checkNull: true
    })
    .customSanitizer(addProtocol)
    .custom(value => URL.parse(value).hostname === env.DEFAULT_DOMAIN)
    .withMessage(`Вы можете отправить жалобу только на ссылку в домене ${env.DEFAULT_DOMAIN}.`)
];

export const banLink = [
  param("id", "ID is invalid.")
    .exists({
      checkFalsy: true,
      checkNull: true
    })
    .isLength({ min: 36, max: 36 }),
  body("host", '"host" should be a boolean.')
    .optional({
      nullable: true
    })
    .isBoolean(),
  body("user", '"user" should be a boolean.')
    .optional({
      nullable: true
    })
    .isBoolean(),
  body("userlinks", '"userlinks" should be a boolean.')
    .optional({
      nullable: true
    })
    .isBoolean(),
  body("domain", '"domain" should be a boolean.')
    .optional({
      nullable: true
    })
    .isBoolean()
];

export const getStats = [
  param("id", "ID is invalid.")
    .exists({
      checkFalsy: true,
      checkNull: true
    })
    .isLength({ min: 36, max: 36 })
];

export const signup = [
  body("password", "Password is not valid.")
    .exists({ checkFalsy: true, checkNull: true })
    .isLength({ min: 8, max: 64 })
    .withMessage("Длина пароля должна быть от 8 до 64."),
  body("email", "Email is not valid.")
    .exists({ checkFalsy: true, checkNull: true })
    .trim()
    .isEmail()
    .isLength({ min: 0, max: 255 })
    .withMessage("Длина адреса электронной почты не должна превышать 255.")
    .custom(async (value, { req }) => {
      const user = await query.user.find({ email: value });

      if (user) {
        req.user = user;
      }

      if (user?.verified) return Promise.reject();
    })
    .withMessage("Вы не можете использовать этот адрес электронной почты.")
];

export const login = [
  body("password", "Password is not valid.")
    .exists({ checkFalsy: true, checkNull: true })
    .isLength({ min: 8, max: 64 })
    .withMessage("Длина пароля должна быть от 8 до 64."),
  body("email", "Email is not valid.")
    .exists({ checkFalsy: true, checkNull: true })
    .trim()
    .isEmail()
    .isLength({ min: 0, max: 255 })
    .withMessage("Длина адреса электронной почты не должна превышать 255.")
];

export const changePassword = [
  body("password", "Password is not valid.")
    .exists({ checkFalsy: true, checkNull: true })
    .isLength({ min: 8, max: 64 })
    .withMessage("Длина пароля должна быть от 8 до 64.")
];

export const resetPasswordRequest = [
  body("email", "Email is not valid.")
    .exists({ checkFalsy: true, checkNull: true })
    .trim()
    .isEmail()
    .isLength({ min: 0, max: 255 })
    .withMessage("Длина адреса электронной почты не должна превышать 255."),
  body("password", "Password is not valid.")
    .exists({ checkFalsy: true, checkNull: true })
    .isLength({ min: 8, max: 64 })
    .withMessage("Длина пароля должна быть от 8 до 64.")
];

export const resetEmailRequest = [
  body("email", "Email is not valid.")
    .exists({ checkFalsy: true, checkNull: true })
    .trim()
    .isEmail()
    .isLength({ min: 0, max: 255 })
    .withMessage("Длина адреса электронной почты не должна превышать 255.")
];

export const deleteUser = [
  body("password", "Password is not valid.")
    .exists({ checkFalsy: true, checkNull: true })
    .isLength({ min: 8, max: 64 })
    .custom(async (password, { req }) => {
      const isMatch = await bcrypt.compare(password, req.user.password);
      if (!isMatch) return Promise.reject();
    })
];

export const cooldown = (user: User) => {
  if (!env.GOOGLE_SAFE_BROWSING_KEY || !user || !user.cooldowns) return;

  // If has active cooldown then throw error
  const hasCooldownNow = user.cooldowns.some(cooldown =>
    isAfter(subHours(new Date(), 12), new Date(cooldown))
  );

  if (hasCooldownNow) {
    throw new CustomError("URL-адрес заблокирован как вредоносный. Подождите 12ч");
  }
};

export const malware = async (user: User, target: string) => {
  if (!env.GOOGLE_SAFE_BROWSING_KEY) return;

  const isMalware = await axios.post(
    `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${env.GOOGLE_SAFE_BROWSING_KEY}`,
    {
      client: {
        clientId: env.DEFAULT_DOMAIN.toLowerCase().replace(".", ""),
        clientVersion: "1.0.0"
      },
      threatInfo: {
        threatTypes: [
          "THREAT_TYPE_UNSPECIFIED",
          "MALWARE",
          "SOCIAL_ENGINEERING",
          "UNWANTED_SOFTWARE",
          "POTENTIALLY_HARMFUL_APPLICATION"
        ],
        platformTypes: ["ANY_PLATFORM", "PLATFORM_TYPE_UNSPECIFIED"],
        threatEntryTypes: [
          "EXECUTABLE",
          "URL",
          "THREAT_ENTRY_TYPE_UNSPECIFIED"
        ],
        threatEntries: [{ url: target }]
      }
    }
  );
  if (!isMalware.data || !isMalware.data.matches) return;

  if (user) {
    const [updatedUser] = await query.user.update(
      { id: user.id },
      {
        cooldowns: knex.raw("array_append(cooldowns, ?)", [
          new Date().toISOString()
        ]) as any
      }
    );

    // Ban if too many cooldowns
    if (updatedUser.cooldowns.length > 2) {
      await query.user.update({ id: user.id }, { banned: true });
      throw new CustomError("Слишком много запросов о вредоносных ссылках. Выша учетная запись заблокирована.");
    }
  }

  throw new CustomError(
    user ? "Обнаружена вредоносная ссылка! Время восстановления 12ч." : "Вредоносная ссылка!"
  );
};

export const linksCount = async (user?: User) => {
  if (!user) return;

  const count = await query.link.total({
    user_id: user.id,
    created_at: [">", subDays(new Date(), 1).toISOString()]
  });

  if (count > env.USER_LIMIT_PER_DAY) {
    throw new CustomError(
      `Вы достигли дневного лимита (${env.USER_LIMIT_PER_DAY}). Пожалуйста, подождите 24ч.`
    );
  }
};

export const bannedDomain = async (domain: string) => {
  const isBanned = await query.domain.find({
    address: domain,
    banned: true
  });

  if (isBanned) {
    throw new CustomError("URL-адрес содержит вредоносное ПО/мошенничество.", 400);
  }
};

export const bannedHost = async (domain: string) => {
  let isBanned;

  try {
    const dnsRes = await dnsLookup(domain);

    if (!dnsRes || !dnsRes.address) return;

    isBanned = await query.host.find({
      address: dnsRes.address,
      banned: true
    });
  } catch (error) {
    isBanned = null;
  }

  if (isBanned) {
    throw new CustomError("URL-адрес содержит вредоносное ПО/мошенничество.", 400);
  }
};
