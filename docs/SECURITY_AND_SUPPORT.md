# hiday security and support, in plain words

This guide is for people who talk about hiday: marketing, sales, and anyone answering questions in forums or from customers. It explains how hiday keeps data safe, what it never does, and what isn't built yet, without the technical jargon.

Everything here was checked against the product in November 2026. Please don't claim more than this page says. Technical readers will check, and an honest answer wins more trust than a big one.

## The short version

- **Your data is stored with well-known, certified providers, and encrypted.** Screenshots are stored with Wasabi and the database runs on Railway. Both encrypt stored data.
- **Passwords are never stored.** hiday keeps only a scrambled fingerprint of each password that can't be turned back into the password.
- **Anyone can read the code.** hiday is open source, so experts can check every claim on this page for themselves.
- **It doesn't spy.** Nothing is recorded unless a timer is running, staff can always see when tracking is on, and what someone types is never recorded.
- **Companies can run it themselves.** A company can host hiday on its own servers for free, so its data never leaves the building.

## Where the data lives

hiday Cloud uses two specialist providers instead of storing data on servers we look after ourselves.

| What | Where it's kept | How it's protected |
| --- | --- | --- |
| Screenshots and other files | [Wasabi](https://wasabi.com), a cloud storage company | Every file is encrypted with AES-256, the same standard banks use. Wasabi holds ISO/IEC 27001 certification for information security. |
| Everything else (accounts, time, activity, reports) | [Railway](https://railway.com), a cloud hosting company | Railway encrypts stored data with AES-256 and holds SOC 2 Type II certification, an independent audit of its security. |

Some other points worth knowing:

- **Screenshots can't be opened just by guessing an address.** To view one, hiday creates a private link that stops working after 5 minutes.
- **Screenshots are deleted automatically.** Each company chooses how long to keep them, and hiday removes them after that.
- **A company can delete its account and all its data.** Data is removed after a waiting period, or straight away if the owner chooses.
- **The database is backed up continuously.** It can be restored to any point in time, so if something went wrong we could bring the data back exactly as it was at a chosen moment, not just to the last daily copy.
- **Self-hosting is an option.** A company that wants complete control can run hiday on its own servers and storage instead of using hiday Cloud.

## Keeping accounts safe

- **Passwords are scrambled with Argon2.** This is the method security experts currently recommend. Even if someone stole the database, they couldn't read anyone's password.
- **Password reset and invite links are protected the same way.** They're stored in scrambled form, they expire (a reset link lasts one hour), and each one works only once.
- **Repeated wrong guesses are slowed down.** After 5 wrong passwords, the login page asks for a "prove you're not a robot" check. Logins are also limited per minute to slow down automated attacks.
- **"Sign out of every device" works instantly.** If someone thinks their account is at risk, one click signs them out of every browser and every computer straight away, not hours later.
- **hiday notices stolen logins.** If a copied login is used after it has already been replaced, hiday signs that person out everywhere.
- **Removing someone's access takes effect immediately.** hiday checks a person's role every time they do something, so a change to their access applies straight away.

## The desktop app

- **No password is typed into the app.** The desktop app is linked to an account by approving it from the website, a bit like signing in to a TV app with your phone.
- **The app's login is kept in the computer's own secure storage.** This is the same secure storage the computer uses for its saved Wi-Fi and email passwords.
- **The app can't run secretly.** An icon is always visible while tracking is on.
- **Admins can see every linked computer** and sign any of them out.

## What hiday never does

People are rightly wary of tools that monitor work. These are hard limits, built into the product:

- **It never records what someone types.** It only notes whether the keyboard or mouse was being used, as a percentage of each 10 minutes.
- **It records nothing unless a timer is running.** When the timer is off, the app collects nothing.
- **It doesn't run hidden.** A tray icon shows whenever tracking is on.
- **It doesn't install anything in the browser.** Websites are read from the browser's address bar in the same way screen readers for blind users do it.
- **It throws away sensitive links.** Addresses that look like password resets or one-time login links are not recorded.
- **Staff are told what's collected.** Admins can publish a notice explaining what hiday records, and hiday notes that each person has seen it.
- **Admins choose what's collected.** Each kind of tracking can be switched on or off for everyone, or for one person.

## Being open about it

- **The code is public.** hiday is open source under the AGPL-3.0 licence, so anyone can read exactly how it works. For a monitoring tool, this is the strongest trust argument we have: you don't have to take our word for it.
- **Security problems can be reported privately.** Researchers report problems through a private channel on GitHub, and we reply within 3 working days. The process is in the project's [SECURITY.md](../SECURITY.md).
- **Changes are logged.** Important actions, such as editing someone's time or changing settings, are recorded with who did what and when.

## What isn't built yet

Saying this before someone else does builds trust. These are known gaps:

- **Two-step login (2FA) and single sign-on (SSO).** The settings page for them exists, but neither works yet. This is the question tech audiences ask first.
- **The desktop app isn't "signed" yet.** Windows and Mac show a warning the first time it's installed, because it doesn't yet carry a verified publisher name. People have to click past that warning once.
- **No independent security audit yet.** hiday hasn't had a penetration test or a SOC 2 audit of its own. Our hosting providers are certified, but hiday as a product is not. Please don't suggest otherwise.
- **Staff can quit the desktop app.** Locking it on company computers is planned.

A suggested answer when asked: *"Two-step login and SSO are on our roadmap. The code is open source, so you can review our security yourself, and if you need full control you can host hiday on your own servers."*

## Getting help

Help available today:

- **Written guides** cover installing, self-hosting, and what the app can and can't do.
- **A contact form** on the website.
- **Private security reporting**, as described above.
- **A Devices page** that shows admins when the desktop app has stopped capturing on a computer, which helps find problems before staff notice them.

Still to decide. We haven't published these yet, so please don't promise them:

- A support email address and how quickly we reply (for example, within one working day).
- Where self-hosting users go for help. GitHub Discussions is the usual choice for open-source projects.
- A status page showing whether hiday Cloud is up.
- Paid support for larger companies that host hiday themselves.

## Common questions

**Is my data safe?**
Yes. Screenshots are stored with Wasabi and everything else with Railway. Both are established cloud providers that encrypt stored data and hold recognised security certifications. The database is also backed up continuously and can be restored to any point in time. Passwords are never stored in readable form.

**Can my employer see what I type?**
No. hiday only records whether the keyboard or mouse was in use, never which keys were pressed.

**Does it track me when I'm not working?**
No. Nothing is recorded unless a timer is running, and an icon shows whenever tracking is on.

**Can I see the code?**
Yes. hiday is open source and the code is public.

**Can we keep our data in-house?**
Yes. Self-hosting is free for any team size, and the data stays on your own servers.

**Do you have 2FA or SSO?**
Not yet. Both are planned.

**Are you SOC 2 certified?**
hiday itself isn't. Our database host, Railway, holds SOC 2 Type II, and our storage provider, Wasabi, holds ISO/IEC 27001.
