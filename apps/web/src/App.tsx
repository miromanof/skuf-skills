import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { parseExternalVideoUrl, type ExternalVideo } from './shared/media/video.js';
import { ThemeSwitch } from './shared/theme/ThemeSwitch.js';
import { AdminLoginPage } from './features/admin/AdminLoginPage.js';
import { AdminQueuePage } from './features/admin/AdminQueuePage.js';
import { AdminEditorPage } from './features/admin/AdminEditorPage.js';
import { publicRequest, type PublicContent } from './shared/api/client.js';
import { apiUrl } from './shared/api/origin.js';
import { createIdempotencyKey } from './shared/idempotency-key.js';
import { QuizPage } from './features/quiz/QuizPage.js';

type Route = 'home' | 'dictionary' | 'memology' | 'quiz' | 'submit' | 'admin-login' | 'admin';
type CardMedia = { kind: 'video'; url: string } | { kind: 'image'; url: string; alt: string };
type Card = { type: string; title: string; text: string; example: string; accent: string; aliases?: string[]; etymology?: string; context?: string; slug?: string; media?: CardMedia; year?: number; source?: { label: string; url: string } };
type Tone = 'Позитивный' | 'Негативный' | 'Нейтральный' | 'Ироничный';

const alphabet = ['Все', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'А', 'Б', 'В', 'Г', 'Д', 'Ж', 'З', 'И', 'К', 'Л', 'М', 'Н', 'О', 'П', 'Р', 'С', 'Т', 'Ф', 'Х', 'Ч', 'Ш', 'Э', 'Ю', 'Я', '#'];
const cardPalette = ['violet', 'lime', 'pink', 'cyan', 'orange', 'yellow'];
const dictionaryCards: Card[] = [
  { type: 'Словарь', title: 'Аура', text: 'Условные очки репутации: их можно заработать или потерять.', example: '«Помог котёнку — плюс сто к ауре»', accent: 'violet' },
  { type: 'Словарь', title: 'База', text: 'Одобрение точного, очевидного или смелого высказывания.', example: '«Наконец-то кто-то это сказал. База»', accent: 'orange' },
  { type: 'Словарь', title: 'Брейнрот', text: 'Контент, который навязчиво занимает мысли из-за постоянного повторения.', example: '«Эта песня — мой новый брейнрот»', accent: 'violet' },
  { type: 'Словарь', title: 'Вайб', text: 'Общее настроение места, человека или события.', example: '«У этой кофейни очень уютный вайб»', accent: 'lime' },
  { type: 'Словарь', title: 'Делулу', text: 'Иронично о вере в приятную, но малореалистичную картину.', example: '«Я делулу, но вдруг концерт всё-таки будет»', accent: 'orange' },
  { type: 'Словарь', title: 'Имба', text: 'Что-то чрезмерно сильное, выгодное или просто очень хорошее.', example: '«Эта функция — имба, экономит час»', accent: 'lime' },
  { type: 'Словарь', title: 'Краш', text: 'Человек, который очень нравится или в которого влюблены.', example: '«Это мой краш ещё с первой серии»', accent: 'violet' },
  { type: 'Словарь', title: 'Кринж', text: 'Сильная неловкость или стыд за происходящее.', example: '«Пересмотрел старое видео — кринж»', accent: 'orange' },
  { type: 'Словарь', title: 'Лор', text: 'Предыстория персонажа, события, сообщества или локальной шутки.', example: '«Чтобы понять мем, надо знать лор чата»', accent: 'lime' },
  { type: 'Словарь', title: 'Могать', text: 'Демонстративно превосходить кого-то внешностью, стилем или уверенностью.', example: '«Он всех замогал одним выходом»', accent: 'violet' },
  { type: 'Словарь', title: 'Нормис', text: 'Обычный человек вне узкой субкультуры или специфического интернет-контекста.', example: '«Этот мем уже и нормисы знают»', accent: 'orange' },
  { type: 'Словарь', title: 'Огайо', text: 'Мемная характеристика чего-то абсурдного, странного или подозрительного.', example: '«Что здесь происходит? Какой-то Огайо»', accent: 'lime' },
  { type: 'Словарь', title: 'Пикми', text: 'Человек, который ищет одобрения, подчёркнуто противопоставляя себя другим.', example: '«Фраза прозвучала немного пикми»', accent: 'violet' },
  { type: 'Словарь', title: 'Пов', text: 'Формат «от первого лица»: ситуация с определённой точки зрения.', example: '«Пов: пришёл на пару раньше преподавателя»', accent: 'orange' },
  { type: 'Словарь', title: 'Ризз', text: 'Обаяние и умение легко заинтересовать собой другого человека.', example: '«У него невероятный ризз»', accent: 'lime' },
  { type: 'Словарь', title: 'Рофл', text: 'Шутка, несерьёзное действие или смех над ситуацией.', example: '«Да это был рофл, не переживай»', accent: 'violet' },
  { type: 'Словарь', title: 'Сигма', text: 'Мемный образ самостоятельного одиночки; часто употребляется иронично.', example: '«Ушёл с вечеринки первым — настоящий сигма»', accent: 'orange' },
  { type: 'Словарь', title: 'Скуф', text: 'Ироничное название немодного взрослого мужчины, который отстал от трендов.', example: '«Включил режим скуфа и лёг спать в десять»', accent: 'lime' },
  { type: 'Словарь', title: 'Тильт', text: 'Раздражение и потеря концентрации после неудачи.', example: '«После третьего проигрыша я в тильте»', accent: 'violet' },
  { type: 'Словарь', title: 'Флексить', text: 'Демонстративно показывать успех, стиль, вещи или уверенность.', example: '«Он флексит новыми кроссовками»', accent: 'orange' },
  { type: 'Словарь', title: 'Чиназес', text: 'Эмоциональное одобрение: всё отлично и получилось как надо.', example: '«Сдал экзамен — вот это чиназес»', accent: 'lime' },
  { type: 'Словарь', title: 'Шипперить', text: 'Хотеть, чтобы два человека или персонажа стали парой.', example: '«Фанаты шипперят их с первого сезона»', accent: 'violet' },
  { type: 'English', title: 'Slay / Слей', aliases: ['slay', 'слей', 'слэй'], text: 'Восхищение тем, как кто-то выглядит или что-то сделал: «блестяще», «разрыв».', example: '«Этот образ — слей!»', accent: 'lime', etymology: 'От английского slay — буквально «сразить»; в сленге — впечатлить наповал.' },
  { type: 'English', title: 'NPC / Энписи', aliases: ['npc', 'нпс', 'энписи', 'эн-пи-си'], text: 'Человек, который ведёт себя шаблонно, будто у него нет собственного сценария.', example: '«Он повторяет один ответ как NPC»', accent: 'violet', etymology: 'Сокращение от non-player character — неигровой персонаж в видеоигре.' },
  { type: 'English', title: 'AFK / АФК', aliases: ['afk', 'афк', 'а-ф-к'], text: 'Человек временно отошёл и не отвечает в игре или чате.', example: '«Я на пять минут АФК»', accent: 'orange', etymology: 'Сокращение от away from keyboard — «отошёл от клавиатуры».' },
  { type: 'English', title: 'OFC / Офк', aliases: ['ofc', 'офк', 'ofk'], text: 'Короткое подтверждение: «конечно», «само собой».', example: '«Ты придёшь?» — «Офк»', accent: 'lime', etymology: 'Сокращение от of course. Написание OFK встречается как фонетическая ошибка, но исходная форма — OFC.' },
  { type: 'English', title: 'Sus / Сас', aliases: ['sus', 'сас', 'сус'], text: 'Подозрительный, странный или вызывающий недоверие.', example: '«Это объяснение звучит сас»', accent: 'violet', etymology: 'Сокращение от suspicious — «подозрительный»; популярность усилила игра Among Us.' },
  { type: 'English', title: 'Mid / Мид', aliases: ['mid', 'мид', 'мидовый'], text: 'Посредственный: не ужасно, но заметно ниже ожиданий.', example: '«Сериал оказался мид»', accent: 'orange', etymology: 'От английского middle — «середина», то есть средний уровень.' },
  { type: 'English', title: 'GOAT / Гоут', aliases: ['goat', 'гоут', 'гоат'], text: 'Лучший человек в своей сфере или за всю историю.', example: '«Для меня этот игрок — GOAT»', accent: 'lime', etymology: 'Акроним greatest of all time — «величайший всех времён».' },
  { type: 'English', title: 'Ate / Эйт', aliases: ['ate', 'эйт', 'съел'], text: 'Кто-то выступил или выглядел настолько хорошо, что не оставил конкурентам шансов.', example: '«Она вышла на сцену и просто ate»', accent: 'violet', etymology: 'От английского ate — «съел/съела»; часть выражения ate and left no crumbs.' },
  { type: 'English', title: 'No cap / Ноу кэп', aliases: ['no cap', 'ноу кэп', 'ноукэп', 'cap'], text: '«Без вранья», «серьёзно»; cap, наоборот, означает ложь или преувеличение.', example: '«Это лучший трек года, no cap»', accent: 'orange', etymology: 'Пришло из афроамериканского английского, где cap означает хвастовство или ложь.' },
  { type: 'English', title: 'Bestie / Бести', aliases: ['bestie', 'бести', 'бэсти'], text: 'Лучший друг или подруга; иногда дружелюбное обращение к собеседнику.', example: '«Бести, ты это видела?»', accent: 'lime', etymology: 'Уменьшительная форма от best friend — «лучший друг».' },
  { type: 'English', title: 'Glow-up / Глоу-ап', aliases: ['glow up', 'glow-up', 'глоу ап', 'глоуап'], text: 'Заметное улучшение внешности, стиля, уверенности или жизни в целом.', example: '«Какой глоу-ап за лето!»', accent: 'violet', etymology: 'От glow — «сиять» и up — усиление или движение вверх.' },
  { type: 'English', title: 'IRL / ИРЛ', aliases: ['irl', 'ирл', 'и-р-л'], text: 'В реальной жизни, а не в интернете или игре.', example: '«Мы знакомы только онлайн, не IRL»', accent: 'orange', etymology: 'Сокращение от in real life — «в реальной жизни».' },
  { type: 'English', title: 'POV / ПОВ', aliases: ['pov', 'пов', 'пи-оу-ви'], text: 'Ракурс или ситуация, показанная с определённой точки зрения.', example: '«POV: ты забыл про домашку»', accent: 'lime', etymology: 'Сокращение от point of view — «точка зрения».' },
  { type: 'English', title: 'W / Дабл-ю', aliases: ['w', 'дабл ю', 'дабл-ю', 'вин'], text: 'Победа, успех или одобрение удачного поступка.', example: '«Сдать всё досрочно — это W»', accent: 'violet', etymology: 'Первая буква английского win — «победа».' },
  { type: 'English', title: 'L / Эл', aliases: ['l', 'эл', 'луз'], text: 'Поражение, провал или неудачное решение.', example: '«Опоздать на последний автобус — жёсткий L»', accent: 'orange', etymology: 'Первая буква английского loss — «поражение».' },
  { type: 'English', title: 'FYP / ФУП', aliases: ['fyp', 'фуп', 'эф-вай-пи'], text: 'Лента рекомендаций; также подпись или хештег с надеждой попасть в неё.', example: '«Этот ролик точно залетит в FYP»', accent: 'lime', etymology: 'Сокращение от for you page — страница «Для вас» в TikTok.' },
];
const memeCards: Card[] = [
  { type: 'Мемология', title: 'Рикролл', text: 'Розыгрыш: ссылка обещает один материал, но неожиданно открывает клип Never Gonna Give You Up.', example: '«Мне прислали важную инструкцию, а там снова рикролл»', accent: 'orange', etymology: 'Мем вырос из интернет-розыгрышей 2007 года и получил название от имени исполнителя Рика Эстли.', media: { kind: 'video', url: 'https://rutube.ru/video/213843b86f37d3f56a1b23dd6ea784a5/' } },
  { type: 'Мемология', title: 'Альтушка с Госуслуг', text: 'Шутка о вымышленной госпрограмме, по которой каждому скуфу положена альтушка.', example: '«Где подать заявление на альтушку с Госуслуг?»', accent: 'violet', year: 2024, slug: 'альтушка-с-госуслуг', context: 'Используют в шутках о знакомствах, контрасте субкультур и разнице поколений.', etymology: 'В начале 2024 года в Рунете разошлись картинки о паре из скуфа и альтернативно выглядящей девушки.', media: { kind: 'image', url: 'https://opis-cdn.tinkoffjournal.ru/mercury/mini-cover-altushki.ryr3v4kommoe..jpg', alt: 'Мемы об альтушке с Госуслуг' }, source: { label: 'Т—Ж: лучшие мемы 2024', url: 'https://t-j.ru/list/best-memes-2024/' } },
  { type: 'Мемология', title: 'Стоять, ковбой', text: 'Танцующий наггетс в ковбойской шляпе под искажённую Cotton Eye Joe.', example: '«Стоять, ковбой, куда собрался?»', accent: 'lime', year: 2024, slug: 'стоять-ковбой', context: 'Абсурдная реакция, которой останавливают героя или внезапно прерывают действие.', etymology: 'Западный тикток-мем в Рунете получил имя по реплике «Стоять, ковбой».', media: { kind: 'image', url: 'https://opis-cdn.tinkoffjournal.ru/mercury/mini-cover-cowboy-nuggets.85q8clh6ymbj..jpg', alt: 'Танцующий наггетс-ковбой' }, source: { label: 'Т—Ж: лучшие мемы 2024', url: 'https://t-j.ru/list/best-memes-2024/' } },
  { type: 'Мемология', title: 'Грустный хомяк', text: 'Хомяк с огромными влажными глазами для небольших, но очень понятных печалей.', example: '«Когда попросил остановить у дома, а водитель уже проехал»', accent: 'cyan', year: 2024, slug: 'грустный-хомяк', context: 'Реакция на неловкость, разочарование и ситуации, где жалко себя или другого.', etymology: 'Сначала хомяк смотрел в камеру под грустную скрипку в видео, затем стал самостоятельной картинкой-реакцией.', media: { kind: 'image', url: 'https://opis-cdn.tinkoffjournal.ru/mercury/mini-cover-sad-hamster.mahxixzgnfzk..jpg', alt: 'Грустный хомяк с большими глазами' }, source: { label: 'Т—Ж: лучшие мемы 2024', url: 'https://t-j.ru/list/best-memes-2024/' } },
  { type: 'Мемология', title: 'Педро', text: 'Танцующий енот в круглом кадре под припев «Педро-Педро-Педро».', example: '«Пара закончилась раньше — включаем Педро»', accent: 'orange', year: 2024, slug: 'педро', context: 'Передаёт внезапную радость и желание праздновать маленькую победу.', etymology: 'Видео с енотом объединили с ускоренной версией песни Pedro итальянской певицы Рафаэллы Карры.', media: { kind: 'image', url: 'https://opis-cdn.tinkoffjournal.ru/mercury/mini-enot.gildycj2vjas..gif', alt: 'Танцующий енот Педро' }, source: { label: 'Т—Ж: лучшие мемы 2024', url: 'https://t-j.ru/list/best-memes-2024/' } },
  { type: 'Мемология', title: 'Мистер Фреш', text: 'Невозмутимый уличный кот, который ждёт только свежую порцию корма.', example: '«Когда разогретое не подходит: режим Мистера Фреша»', accent: 'yellow', year: 2024, slug: 'мистер-фреш', context: 'Шутка о терпении, высоких стандартах и демонстративном отказе от неподходящего.', etymology: 'Кот стал известен благодаря трансляциям умных кормушек в китайском приложении Hello Street Cat.', media: { kind: 'image', url: 'https://opis-cdn.tinkoffjournal.ru/mercury/feed-cat__minicover.png', alt: 'Кот Мистер Фреш' }, source: { label: 'Т—Ж: лучшие мемы 2024', url: 'https://t-j.ru/list/best-memes-2024/' } },
  { type: 'Мемология', title: 'Сидим с бобром за столом', text: 'Прилипчивая песня о дружеской трапезе с бобром и приготовленном полене.', example: '«Вечер по плану: сидим с бобром за столом»', accent: 'pink', year: 2025, slug: 'сидим-с-бобром', context: 'Звук для домашних животных, семейных сцен и нарочито уютного абсурда.', etymology: 'Песня «Бобр» стала первым массовым мемом 2025 года и отсылала к старому «Бобр курва».', media: { kind: 'image', url: 'https://opis-cdn.tinkoffjournal.ru/mercury/mini-bobr.png', alt: 'Мем «Сидим с бобром за столом»' }, source: { label: 'Т—Ж: лучшие мемы 2025', url: 'https://t-j.ru/list/best-memes-2025/' } },
  { type: 'Мемология', title: 'Итальянский брейнрот', text: 'ИИ-животные, скрещённые с предметами, с псевдоитальянскими рифмованными именами.', example: '«Тралалеро Тралала опять захватил всю ленту»', accent: 'lime', year: 2025, slug: 'итальянский-брейнрот', context: 'Абсурдные ролики, коллекции персонажей, игры и шутки без обязательного смысла.', etymology: 'Формат вырос из нейросетевых роликов с Тралалеро Тралала, Бомбардиро Крокодило и другими героями.', media: { kind: 'image', url: 'https://opis-cdn.tinkoffjournal.ru/mercury/04-best-memes-2025.jpg', alt: 'Персонажи итальянского брейнрота' }, source: { label: 'Т—Ж: лучшие мемы 2025', url: 'https://t-j.ru/list/best-memes-2025/' } },
  { type: 'Мемология', title: 'Окак', text: 'Кот в капюшоне и короткая реакция на внезапный или неловкий поворот.', example: '«Дедлайн сегодня, а не завтра. Окак»', accent: 'violet', year: 2025, slug: 'окак', context: 'Универсальный ответ на бытовое открытие, неприятный сюрприз или странную новость.', etymology: 'Морду чёрного кота совместили с силуэтом человека, а выражение «о как» написали слитно.', media: { kind: 'image', url: 'https://opis-cdn.tinkoffjournal.ru/mercury/01-upd-best-memes-2025.jpg', alt: 'Кот в капюшоне из мема «Окак»' }, source: { label: 'Т—Ж: лучшие мемы 2025', url: 'https://t-j.ru/list/best-memes-2025/' } },
  { type: 'Мемология', title: 'Aura farming', text: 'Эффектный танец или жест, который будто накапливает человеку очки харизмы.', example: '«Вышел к доске без подготовки и начал фармить ауру»', accent: 'cyan', year: 2025, slug: 'aura-farming', context: 'Так отмечают уверенное поведение, зрелищный выход или спокойствие под давлением.', etymology: 'Мем вырос из видео индонезийских лодочных гонок, где мальчик на носу лодки танцует для команды.', media: { kind: 'image', url: 'https://opis-cdn.tinkoffjournal.ru/mercury/mini-aura-farming.png', alt: 'Мальчик танцует на носу лодки' }, source: { label: 'Т—Ж: лучшие мемы 2025', url: 'https://t-j.ru/list/best-memes-2025/' } },
  { type: 'Мемология', title: '6—7', text: 'Намеренно бессмысленный выкрик и жест руками, ставшие маркером «своих».', example: '«Открыли страницу 67 — весь класс: six-seven!»', accent: 'orange', year: 2025, slug: 'шесть-семь', context: 'Реакция поколения альфа на числа шесть и семь; смысл — в самом узнавании шутки.', etymology: 'Фраза пришла из трека Skrilla и баскетбольных эдитов, а затем распространилась среди школьников.', media: { kind: 'image', url: 'https://opis-cdn.tinkoffjournal.ru/mercury/explain-this-mem-67-minicover.png', alt: 'Мем 6—7' }, source: { label: 'Т—Ж: лучшие мемы 2025', url: 'https://t-j.ru/list/best-memes-2025/' } },
  { type: 'Мемология', title: 'Фа ватафа пепе шнейне', text: 'Набор придуманных междометий, которым выражают почти любую эмоцию.', example: '«Фа ватафа — контрольную перенесли!»', accent: 'pink', year: 2026, slug: 'фа-ватафа', context: 'Фразы вставляют в бытовые шутки и абсурдные реакции, часто уже без связи с автором.', etymology: 'Рэпер Ганвест начал вплетать придуманные слова в речь и короткие ролики при перезапуске карьеры.', media: { kind: 'image', url: 'https://opis-cdn.tinkoffjournal.ru/mercury/mini-gunwest-watafa.png', alt: 'Ганвест и фраза «Фа ватафа»' }, source: { label: 'Т—Ж: лучшие мемы 2026', url: 'https://t-j.ru/best-memes-2026/' } },
  { type: 'Мемология', title: 'Пингвин-нигилист', text: 'Одинокий пингвин покидает стаю и решительно идёт к далёкой горе.', example: '«Когда все пошли на пару, а ты — пингвин к своей горе»', accent: 'yellow', year: 2026, slug: 'пингвин-нигилист', context: 'Метафора собственного пути, выгорания, упрямства или желания уйти от общества.', etymology: 'Кадр из фильма Вернера Херцога «Встречи на краю света» соединили с драматичной музыкой.', media: { kind: 'image', url: 'https://opis-cdn.tinkoffjournal.ru/mercury/mini-nihilist-penguin-meme.png', alt: 'Пингвин идёт к горе' }, source: { label: 'Т—Ж: лучшие мемы 2026', url: 'https://t-j.ru/best-memes-2026/' } },
  { type: 'Мемология', title: 'Данил Колбасенко', text: 'Добрый мем со школьником, который с огромным энтузиазмом называет своё имя.', example: '«Представился с уверенностью Данила Колбасенко»', accent: 'violet', year: 2026, slug: 'данил-колбасенко', context: 'Звук накладывают на эдиты о харизме, дружбе и неожиданно легендарных героях.', etymology: 'Фраза взята из фрагмента стрима; сначала её подхватили геймерские и аниме-сообщества.', media: { kind: 'image', url: 'https://opis-cdn.tinkoffjournal.ru/mercury/mini-danil-kolbasenko.png', alt: 'Данил Колбасенко' }, source: { label: 'Т—Ж: лучшие мемы 2026', url: 'https://t-j.ru/best-memes-2026/' } },
  { type: 'Мемология', title: 'Нишевость', text: 'Ироничная мера загадочности человека с редкими вкусами и необычными интересами.', example: '«Этот плейлист слишком популярный — минус нишевость»', accent: 'lime', year: 2026, slug: 'нишевость', context: 'Одновременно комплимент необычному вкусу и пародия на желание быть «не как все».', etymology: 'Маркетинговое слово «нишевый» перенесли с продуктов и искусства на людей и их образ жизни.', media: { kind: 'image', url: 'https://opis-cdn.tinkoffjournal.ru/mercury/nishevost-test-mini-cover.jpg', alt: 'Мемы о нишевости' }, source: { label: 'Т—Ж: лучшие мемы 2026', url: 'https://t-j.ru/best-memes-2026/' } },
  { type: 'Мемология', title: 'Возьми телефон, детка', text: 'Прилипчивая строчка и танец из домашнего концерт-стрима рэпера Toxis.', example: '«Третий пропущенный: возьми телефон, детка»', accent: 'cyan', year: 2026, slug: 'возьми-телефон-детка', context: 'Шутки о пропущенных звонках и моменты, когда вместо объяснения остаётся только танцевать.', etymology: 'Фрагмент песни Nobody завирусился после того, как из стрима вырезали неидеальное, но обаятельное исполнение.', media: { kind: 'image', url: 'https://opis-cdn.tinkoffjournal.ru/mercury/mini-vozmi-telephon.png', alt: 'Мем «Возьми телефон, детка»' }, source: { label: 'Т—Ж: лучшие мемы 2026', url: 'https://t-j.ru/best-memes-2026/' } },
  { type: 'Мемология', title: 'Обезьянка Панч', text: 'История маленькой макаки с плюшевым другом, за успехами которой следил интернет.', example: '«Панч снова не один — сегодня хорошие новости»', accent: 'orange', year: 2026, slug: 'обезьянка-панч', context: 'Трогательная реакция на одиночество, поддержку и маленькие победы после трудностей.', etymology: 'Ролики из японского зоопарка показали, как осиротевшая макака Панч привязалась к плюшевой игрушке.', media: { kind: 'image', url: 'https://opis-cdn.tinkoffjournal.ru/mercury/rmDdLGT5si.explain-this-obizhaiut-obezianku-pancha-v-iaponskom-zooparke-minicover.png', alt: 'Обезьянка Панч с плюшевой игрушкой' }, source: { label: 'Т—Ж: лучшие мемы 2026', url: 'https://t-j.ru/best-memes-2026/' } },
  { type: 'Мемология', title: 'Запиканные треки', text: 'Новые версии песен, где цензура превращает строки в комичные обрывки и паузы.', example: '«В новой версии от припева осталось три слова и пять пиков»', accent: 'pink', year: 2026, slug: 'запиканные-треки', context: 'Шутки о том, как после редактирования знакомые песни звучат абсурдно и теряют смысл.', etymology: 'Весной 2026 года исполнители начали менять старые релизы, заглушая спорные слова в текстах.', media: { kind: 'image', url: 'https://opis-cdn.tinkoffjournal.ru/mercury/01-upd-best-memes-2026.jpg', alt: 'Подборка мемов 2026 года' }, source: { label: 'Т—Ж: лучшие мемы 2026', url: 'https://t-j.ru/best-memes-2026/' } },
  { type: 'Мемология', title: 'Муся, это ты?', text: 'Тигр в болоте, которого принимают за домашнюю кошку Мусю.', example: '«В куче одинаковых курток: Муся, это ты?»', accent: 'yellow', year: 2026, slug: 'муся-это-ты', context: 'Универсальный шаблон про поиски, ошибочное узнавание и абсурдное сравнение.', etymology: 'Исходная картинка с тигром и ответом «Нет, это не Муся» породила множество замен персонажа.', media: { kind: 'image', url: 'https://opis-cdn.tinkoffjournal.ru/mercury/01-upd-best-memes-2026.jpg', alt: 'Мем «Муся, это ты?»' }, source: { label: 'Т—Ж: лучшие мемы 2026', url: 'https://t-j.ru/best-memes-2026/' } },
  { type: 'Мемология', title: 'ИИ-сериалы про фрукты', text: 'Мелодраматичные нейросетевые мини-сериалы, где фрукты переживают семейные драмы.', example: '«У двух клубник родился банан — жду вторую серию»', accent: 'violet', year: 2026, slug: 'ии-сериалы-про-фрукты', context: 'Нарочито нелогичные клиффхэнгеры, любовные треугольники и обсуждение героев как настоящего сериала.', etymology: 'Весной ленты заполнили короткие ИИ-истории, чаще всего под песню «Камин».', media: { kind: 'image', url: 'https://opis-cdn.tinkoffjournal.ru/mercury/ai-slop-shows-minicover.png', alt: 'Нейросетевой сериал про фрукты' }, source: { label: 'Т—Ж: лучшие мемы 2026', url: 'https://t-j.ru/best-memes-2026/' } },
  { type: 'Мемология', title: 'Пиббл', text: 'Безмятежный белый бульдог танцует и катается на сёрфе среди ИИ-хаоса.', example: '«Дедлайн горит, а я сегодня Пиббл»', accent: 'lime', year: 2026, slug: 'пиббл', context: 'Символ спокойствия и умения радоваться, когда вокруг всё идёт не по плану.', etymology: 'Нейросетевой ролик развил старое ласковое интернет-название маленьких бульдогов — pibble.', media: { kind: 'image', url: 'https://opis-cdn.tinkoffjournal.ru/mercury/mini-pibble-serf.png', alt: 'Белый бульдог Пиббл на сёрфе' }, source: { label: 'Т—Ж: лучшие мемы 2026', url: 'https://t-j.ru/best-memes-2026/' } },
  { type: 'Мемология', title: 'Черемша', text: 'ИИ-существо с телом зайца и головой льва из пародийных рассказов о жизни в СССР.', example: '«Черемша жила в каждой квартире — тихо, не спеша»', accent: 'cyan', year: 2026, slug: 'черемша', context: 'Абсурдные псевдоностальгические истории с диктором и уверенно выдуманными фактами.', etymology: 'Формат пародирует клишированные рассказы об идеальном прошлом при помощи нейросетевых животных.', media: { kind: 'image', url: 'https://opis-cdn.tinkoffjournal.ru/mercury/mini-cheremsha-meme.png', alt: 'Нейросетевое существо Черемша' }, source: { label: 'Т—Ж: лучшие мемы 2026', url: 'https://t-j.ru/best-memes-2026/' } },
  { type: 'Мемология', title: 'Гора Эверест на фоне меня', text: 'Гиперболическое заявление о собственной крутости под мемный кавер.', example: '«Закрыл все задачи до обеда — Эверест на фоне меня»', accent: 'orange', year: 2026, slug: 'гора-эверест-на-фоне-меня', context: 'Ирония над завышенной самооценкой или шуточное празднование своего успеха.', etymology: 'Русский кавер песни Mount Everest Labrinth разошёлся в эдитах и бытовых роликах.', media: { kind: 'image', url: 'https://opis-cdn.tinkoffjournal.ru/mercury/mini-gora-everest-meme.png', alt: 'Мем «Гора Эверест на фоне меня»' }, source: { label: 'Т—Ж: лучшие мемы 2026', url: 'https://t-j.ru/best-memes-2026/' } },
  { type: 'Мемология', title: 'Эрлинг Холанд', text: 'Футболист как добродушный двухметровый викинг и неудержимый герой спортивных эдитов.', example: '«Побежал за автобусом как Холанд за мячом»', accent: 'pink', year: 2026, slug: 'эрлинг-холанд', context: 'Шутки о невероятной скорости, простодушии и контрасте грозного вида с дружелюбным поведением.', etymology: 'Новая волна мемов появилась во время ЧМ-2026 после забега Холанда за соперником.', media: { kind: 'image', url: 'https://opis-cdn.tinkoffjournal.ru/mercury/mini-holland-meme.png', alt: 'Мемы с Эрлингом Холандом' }, source: { label: 'Т—Ж: лучшие мемы 2026', url: 'https://t-j.ru/best-memes-2026/' } },
  { type: 'Мемология', title: 'Тихо, не спеша, без суеты', text: 'Пародийный дикторский оборот из ИИ-роликов о якобы идеальной жизни в прошлом.', example: '«Сдавали проект ночью — тихо, не спеша, без суеты»', accent: 'yellow', year: 2026, slug: 'тихо-не-спеша', context: 'Фразой иронично описывают хаотичные или тяжёлые процессы как спокойную идиллию.', etymology: 'Повторяющееся клише закрепилось в нейросетевых псевдодокументалках про альтернативный СССР.', media: { kind: 'image', url: 'https://opis-cdn.tinkoffjournal.ru/mercury/ai-ussr-meme-in-out.jpg', alt: 'ИИ-мемы о спокойной жизни в СССР' }, source: { label: 'Т—Ж: лучшие мемы 2026', url: 'https://t-j.ru/best-memes-2026/' } },
];

const negativeTerms = new Set(['Кринж', 'Тильт', 'NPC / Энписи', 'Sus / Сас', 'Mid / Мид', 'L / Эл']);
const positiveTerms = new Set(['База', 'Вайб', 'Имба', 'Ризз', 'Рофл', 'Флексить', 'Чиназес', 'Slay / Слей', 'GOAT / Гоут', 'Ate / Эйт', 'Bestie / Бести', 'Glow-up / Глоу-ап', 'W / Дабл-ю']);
const neutralTerms = new Set(['Лор', 'Шипперить', 'AFK / АФК', 'OFC / Офк', 'IRL / ИРЛ', 'POV / ПОВ', 'FYP / ФУП']);

function cardTone(card: Card): Tone {
  if (negativeTerms.has(card.title)) return 'Негативный';
  if (positiveTerms.has(card.title)) return 'Позитивный';
  if (neutralTerms.has(card.title)) return 'Нейтральный';
  return 'Ироничный';
}

function cardContext(card: Card): string {
  if (card.context) return card.context;
  if (card.type === 'English') return 'Встречается в переписке, игровых чатах, комментариях и коротких видео. В русской речи используют как оригинальное написание, так и фонетическую запись кириллицей.';
  if (card.type === 'Мемология') return 'Используется как реакция в комментариях, переписке и под видео. Смысл обычно считывается по ситуации и подаче.';
  return 'Употребляется в неформальной речи, переписке, комментариях и соцсетях. Интонация и отношения между собеседниками могут менять оттенок значения.';
}

function cardSlug(card: Card): string {
  if (card.slug) return card.slug;
  return card.aliases?.find((alias) => /^[a-z0-9]/i.test(alias))?.replace(/\s+/g, '-') ?? card.title.toLocaleLowerCase('ru-RU').replace(/\s+/g, '-');
}

function publicCard(item: PublicContent, index = 0): Card {
  const accents = ['violet', 'orange', 'lime'];
  return {
    type: item.type === 'meme' ? 'Мемология' : 'Словарь', title: item.title, text: item.explanation,
    example: item.example, accent: accents[index % accents.length] ?? 'violet', slug: item.slug,
    aliases: item.tags, ...(item.origin ? { etymology: item.origin } : {}), ...(item.context ? { context: item.context } : {}),
    ...(item.media?.kind === 'video' ? { media: item.media } : {}),
  };
}

function videoDetails(card: Card): ExternalVideo | null {
  if (card.media?.kind !== 'video') return null;
  try { return parseExternalVideoUrl(card.media.url); } catch { return null; }
}

function MediaPreview({ card, compact = false }: { card: Card; compact?: boolean }) {
  if (card.media?.kind === 'image') {
    return (
      <div className={`meme-media term-card__preview${compact ? ' meme-media--compact' : ''}`}>
        <img src={card.media.url} alt={card.media.alt} loading="lazy" referrerPolicy="no-referrer" />
        {!compact && card.source && <a href={card.source.url} target="_blank" rel="noopener noreferrer">{card.source.label} ↗</a>}
      </div>
    );
  }
  const video = videoDetails(card);
  const sourceUrl = card.media?.url;
  if (!video) return compact ? <div className="meme-media meme-media--missing">Превью недоступно</div> : null;
  const platform = video.provider === 'rutube' ? 'RuTube' : 'YouTube';
  return (
    <div className={`meme-media term-card__preview${compact ? ' meme-media--compact' : ''}`}>
      <iframe src={video.embedUrl} title={`${compact ? 'Превью' : 'Видео'} мема «${card.title}»`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
      {!compact && sourceUrl && <a href={sourceUrl} target="_blank" rel="noopener noreferrer">Открыть оригинал на {platform} ↗</a>}
    </div>
  );
}

function usePublicCards(type: 'term' | 'meme') {
  const [cards, setCards] = useState<Card[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let retryTimer: number | undefined;
    setError(false);
    const load = () => {
      void publicRequest<{ items: PublicContent[] }>(`/api/content?type=${type}&limit=50`, controller.signal)
        .then((result) => {
          setCards(result.items.map(publicCard));
          setError(false);
        })
        .catch((reason: unknown) => {
          if (reason instanceof DOMException && reason.name === 'AbortError') return;
          setError(true);
          retryTimer = window.setTimeout(load, 3_000);
        });
    };
    load();
    return () => {
      controller.abort();
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [type]);
  return { cards, error };
}

function currentRoute(): Route {
  if (window.location.hash.startsWith('#/admin/login')) return 'admin-login';
  if (window.location.hash.startsWith('#/admin')) return 'admin';
  if (window.location.hash.startsWith('#/dictionary')) return 'dictionary';
  if (window.location.hash.startsWith('#/memology')) return 'memology';
  if (window.location.hash.startsWith('#/quiz')) return 'quiz';
  if (window.location.hash.startsWith('#/submit')) return 'submit';
  return 'home';
}

function Header({ route }: { route: Route }) {
  return (
    <header className="topbar">
      <a className="brand" href="#/" aria-label="Skuf Skills — на главную"><span>SKUF</span><span>СКИЛС</span></a>
      <nav aria-label="Основная навигация">
        <a className={route === 'dictionary' ? 'nav-active' : ''} href="#/dictionary">Словарь</a>
        <a className={route === 'memology' ? 'nav-active' : ''} href="#/memology">Мемология</a>
        <a className={route === 'quiz' ? 'nav-active' : ''} href="#/quiz">Тест</a>
        <a className="nav-accent" href="#/submit">Добавить карточку</a>
      </nav>
      <ThemeSwitch />
    </header>
  );
}

function TermCard({ card, russianFirst = false, returnLetter, accent }: { card: Card; russianFirst?: boolean; returnLetter?: string; accent?: string }) {
  const titleParts = card.title.split(' / ');
  const displayTitle = russianFirst && titleParts.length === 2 ? `${titleParts[1]} / ${titleParts[0]}` : card.title;
  const titleClassName = displayTitle.length > 20 ? 'term-card__title--very-long' : displayTitle.length > 14 ? 'term-card__title--long' : undefined;
  const showMeta = card.type !== 'Словарь' || card.year !== undefined;
  return (
    <article className={`term-card term-card--${accent ?? card.accent}${card.media ? ' term-card--media' : ''}`}>
      {showMeta && <div className="term-card__meta"><span>{card.type}</span>{card.year && <span className="term-card__year">{card.year}</span>}</div>}
      {card.media && <MediaPreview card={card} compact />}
      <h3 className={titleClassName}>{displayTitle}</h3>
      <p>{card.text}</p>
      <blockquote>{card.example}</blockquote>
      <a className="term-card__open" href={`#/${card.type === 'Мемология' ? 'memology' : 'dictionary'}/${encodeURIComponent(cardSlug(card))}${returnLetter && returnLetter !== 'Все' ? `?from=${encodeURIComponent(returnLetter)}` : ''}`}>Открыть карточку <span>↗</span></a>
    </article>
  );
}

function TermDetail({ card }: { card: Card }) {
  const from = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('from');
  const basePath = card.type === 'Мемология' ? '#/memology' : '#/dictionary';
  const backHref = from ? `${basePath}?letter=${encodeURIComponent(from)}` : basePath;
  return (
    <article className="term-detail">
      <a className="term-detail__back" href={backHref}>← Назад в {card.type === 'Мемология' ? 'мемологию' : 'словарь'}</a>
      <p className="eyebrow"><span /> {card.type}</p>
      <h1>{card.title}</h1>
      {card.year && <p className="term-detail__year">{card.year}</p>}
      {card.aliases && <p className="term-detail__aliases">Также пишут и ищут: {card.aliases.join(' · ')}</p>}
      {card.media && <MediaPreview card={card} />}
      <div className="term-detail__grid">
        <section><h2>Объяснение</h2><p>{card.text}</p></section>
        <section><h2>Применение в речи</h2><blockquote>{card.example}</blockquote></section>
        <section><h2>Контекст</h2><p>{cardContext(card)}</p></section>
        <section><h2>Эмоциональный окрас</h2><strong className={`tone tone--${cardTone(card).toLocaleLowerCase('ru-RU')}`}>{cardTone(card)}</strong><p>Окрас может меняться в зависимости от интонации и отношений между собеседниками.</p></section>
        <section className="term-detail__origin"><h2>Происхождение</h2><p>{card.etymology ?? 'Слово закрепилось в русскоязычной интернет-среде и постепенно перешло из переписки в устную речь.'}</p></section>
      </div>
      {card.source && card.media?.kind !== 'image' && <a className="term-detail__source" href={card.source.url} target="_blank" rel="noopener noreferrer">{card.source.label} ↗</a>}
      <section className="correction-callout">
        <div><p className="eyebrow"><span /> Вместе точнее</p><h2>Нашли неточность?</h2><p>Предложите исправление. Текущая карточка останется на месте, пока редакция не проверит новую версию.</p></div>
        <a className="button button--dark" href={`#/submit?edit=${encodeURIComponent(cardSlug(card))}`}>Предложить изменения</a>
      </section>
    </article>
  );
}

function PublicTermDetail({ slug }: { slug: string }) {
  const [card, setCard] = useState<Card>();
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setMissing(false);
    void publicRequest<PublicContent>(`/api/content/${encodeURIComponent(slug)}`, controller.signal)
      .then((item) => setCard(publicCard(item)))
      .catch((reason: unknown) => { if (!(reason instanceof DOMException && reason.name === 'AbortError')) setMissing(true); });
    return () => controller.abort();
  }, [slug]);
  if (card) return <TermDetail card={card} />;
  if (missing) return <section className="empty-state"><span>404</span><h1>Карточка не найдена</h1><p>Возможно, материал снят с публикации или ссылка устарела.</p><a className="button button--dark" href="#/dictionary">Вернуться в словарь</a></section>;
  return <section className="empty-state" aria-live="polite"><h1>Загружаем карточку…</h1></section>;
}

function HomePage() {
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get('query') ?? '').trim();
    window.location.hash = query ? `#/dictionary?q=${encodeURIComponent(query)}` : '#/dictionary';
  };

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__content">
          <p className="eyebrow"><span /> Словарь поколений</p>
          <h1 id="hero-title">Хочешь быть сигмой?<br /><em>Для начала узнай, кто это</em></h1>
          <p className="hero__lead">Skuf Skills помогает понимать друг друга: простыми словами объясняем молодёжный язык, мемы и контекст.</p>
          <form className="search" role="search" onSubmit={submitSearch}>
            <label className="sr-only" htmlFor="site-search">Найти слово или мем</label>
            <input id="site-search" name="query" type="search" placeholder="имба" />
            <button type="submit">Найти</button>
          </form>
          <div className="hero__actions">
            <a className="button button--dark" href="#/dictionary">Открыть словарь</a>
            <a className="text-link" href="#/submit">Знаешь новое слово? Добавь →</a>
          </div>
        </div>
        <aside className="note-card" aria-label="Как пользоваться Skuf Skills">
          <div className="note-card__bar"><span /><span /><span /><b>read_me.txt</b></div>
          <div className="note-card__body"><span className="note-card__icon" aria-hidden="true">✦</span><p><strong>Здесь не осуждают.</strong><br />Здесь переводят с молодёжного на человеческий.</p></div>
        </aside>
      </section>
      <div className="ticker" aria-hidden="true">
        <div className="ticker__track">
          <span className="ticker__sequence">БАЗА • ВАЙБ • ИМБА • РОФЛ • СИГМА • КРИНЖ • АУРА • </span>
          <span className="ticker__sequence">БАЗА • ВАЙБ • ИМБА • РОФЛ • СИГМА • КРИНЖ • АУРА • </span>
        </div>
      </div>
      <section className="home-choices" aria-label="Разделы проекта">
        <a href="#/dictionary"><h2>Словарь</h2><p>От «ауры» до «я в моменте» — с примерами и контекстом.</p><span>Смотреть все слова ↗</span></a>
        <a href="#/memology"><h2>Мемология</h2><p>Откуда взялся мем, что означает и когда его уместно использовать.</p><span>Разобраться в мемах ↗</span></a>
      </section>
      <section className="quiz-home-cta">
        <span className="quiz-home-cta__score" aria-hidden="true">10/10</span>
        <div><p className="eyebrow"><span /> 10 вопросов · 3 уровня</p><h2>Насколько ты<br />не скуф?</h2><p>Выбери сложность, проверь знание интернет-языка и получи карточку результата для соцсетей.</p></div>
        <a className="button button--light" href="#/quiz">Пройти тест</a>
      </section>
      <Suggest />
    </>
  );
}

function PageIntro({ eyebrow, title, text }: { eyebrow: string; title: ReactNode; text: string }) {
  return <section className="page-intro"><p className="eyebrow"><span /> {eyebrow}</p><h1>{title}</h1><p>{text}</p></section>;
}

function DictionaryPage() {
  const remote = usePublicCards('term');
  const allCards = [...dictionaryCards, ...remote.cards.filter((card) => !dictionaryCards.some((starter) => cardSlug(starter) === cardSlug(card)))];
  const readFilters = () => {
    const query = window.location.hash.split('?')[1] ?? '';
    const params = new URLSearchParams(query);
    const letter = params.get('letter') ?? 'Все';
    return { letter: alphabet.includes(letter) ? letter : 'Все', search: params.get('q') ?? '' };
  };
  const initialFilters = readFilters();
  const [selectedLetter, setSelectedLetter] = useState(initialFilters.letter);
  const [searchQuery, setSearchQuery] = useState(initialFilters.search);
  useEffect(() => {
    const syncFilters = () => {
      const filters = readFilters();
      setSelectedLetter(filters.letter);
      setSearchQuery(filters.search);
    };
    window.addEventListener('hashchange', syncFilters);
    return () => window.removeEventListener('hashchange', syncFilters);
  }, []);
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase('ru-RU');
  const matchesLetter = (card: Card, letter: string) => card.title.split(' / ').some((value) => value.trim().toLocaleUpperCase('ru-RU').startsWith(letter));
  const letterCards = selectedLetter === 'Все' ? allCards : allCards.filter((card) => matchesLetter(card, selectedLetter));
  const filteredCards = normalizedQuery ? allCards.filter((card) => [card.title, card.text, card.example, card.context ?? '', card.etymology ?? '', ...(card.aliases ?? [])].join(' ').toLocaleLowerCase('ru-RU').includes(normalizedQuery)) : letterCards;
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextHash = searchQuery.trim() ? `#/dictionary?q=${encodeURIComponent(searchQuery.trim())}` : '#/dictionary';
    window.history.replaceState(window.history.state, '', nextHash);
  };
  const selectLetter = (letter: string) => {
    setSearchQuery('');
    setSelectedLetter(letter);
    const nextHash = letter === 'Все' ? '#/dictionary' : `#/dictionary?letter=${encodeURIComponent(letter)}`;
    window.history.replaceState(window.history.state, '', nextHash);
  };

  return (
    <>
      <PageIntro eyebrow="Слова, которыми говорят сейчас" title={<><span>Словарь</span><span>От А до Я</span></>} text="Выбери букву или найди термин. Каждое объяснение прошло редакционную проверку." />
      <form className="dictionary-search" role="search" onSubmit={submitSearch}><label htmlFor="dictionary-search">Поиск по словарю</label><div><input id="dictionary-search" type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Slay, слей или слэй" /><button type="submit">Найти</button></div><small>Ищем по названию, написанию, объяснению, примеру и контексту.</small></form>
      {remote.error && <p className="form-status form-status--error" role="alert">Не удалось обновить словарь. Показываем встроенную подборку.</p>}
      <section className="alphabet alphabet--page" aria-label="Алфавит"><div className="alphabet__letters">{alphabet.map((letter) => <button type="button" aria-pressed={selectedLetter === letter} onClick={() => selectLetter(letter)} key={letter}>{letter}</button>)}</div></section>
      <section className="catalog catalog--page" aria-label="Словарные статьи">
        {filteredCards.length > 0 ? <div className="card-grid card-grid--dictionary">{filteredCards.map((card, index) => <TermCard card={card} accent={cardPalette[index % cardPalette.length] ?? 'violet'} russianFirst={/^[А-ЯЁ]$/u.test(selectedLetter)} returnLetter={selectedLetter} key={card.title} />)}</div> : <div className="empty-state"><span>¯\\_(ツ)_/¯</span><h2>{normalizedQuery ? 'Ничего не нашли' : 'На эту букву пока ничего нет'}</h2><p>{normalizedQuery ? 'Попробуй другое написание или более короткий запрос.' : 'Знаешь подходящее слово? Отправь его редакции — регистрация не нужна.'}</p>{!normalizedQuery && <a className="button button--dark" href="#/submit">Добавить термин</a>}</div>}
      </section>
    </>
  );
}

function MemologyPage() {
  const remote = usePublicCards('meme');
  const cards = [...memeCards, ...remote.cards.filter((card) => !memeCards.some((starter) => cardSlug(starter) === cardSlug(card)))];
  return (
    <>
      <PageIntro eyebrow="Архив интернет-культуры" title="Мемология" text="Объясняем происхождение, смысл и контекст мемов — без необходимости притворяться, что всё и так понятно." />
      {remote.error && <p className="form-status form-status--error" role="alert">Не удалось обновить мемологию. Показываем встроенную подборку.</p>}
      <section className="catalog catalog--page" aria-label="Карточки мемов"><div className="card-grid card-grid--dictionary">{cards.map((card, index) => <TermCard card={card} accent={cardPalette[index % cardPalette.length] ?? 'violet'} key={cardSlug(card)} />)}</div></section>
    </>
  );
}

function SubmitPage() {
  const editSlug = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('edit');
  const starterCard = editSlug ? [...dictionaryCards, ...memeCards].find((item) => cardSlug(item) === editSlug) : undefined;
  const [remoteEditCard, setRemoteEditCard] = useState<Card>();
  const [editMissing, setEditMissing] = useState(false);
  const card = starterCard ?? remoteEditCard;
  const editingMeme = card?.type === 'Мемология';
  const [submissionState, setSubmissionState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [newType, setNewType] = useState<'term' | 'meme' | null>(null);
  const [videoUrl, setVideoUrl] = useState(() => starterCard?.media?.kind === 'video' ? starterCard.media.url : '');
  const [idempotencyKey] = useState(createIdempotencyKey);

  useEffect(() => {
    if (!editSlug || starterCard) return;
    const controller = new AbortController();
    setEditMissing(false);
    void publicRequest<PublicContent>(`/api/content/${encodeURIComponent(editSlug)}`, controller.signal)
      .then((item) => {
        const remoteCard = publicCard(item);
        setRemoteEditCard(remoteCard);
        if (remoteCard.media?.kind === 'video') setVideoUrl(remoteCard.media.url);
      })
      .catch((reason: unknown) => { if (!(reason instanceof DOMException && reason.name === 'AbortError')) setEditMissing(true); });
    return () => controller.abort();
  }, [editSlug, starterCard]);

  useEffect(() => {
    if (card?.media?.kind === 'video') setVideoUrl(card.media.url);
  }, [card]);

  const submitNew = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newType) return;
    setSubmissionState('sending');
    const values = new FormData(event.currentTarget);
    const value = (name: string) => String(values.get(name) ?? '').trim();
    const tags = value('tags').split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 8);
    const origin = value('origin');
    const author = value('author');
    const shared = { type: newType, title: value('title'), explanation: value('explanation'), example: value('example'), tags, ...(author ? { author } : {}) };
    const payload = newType === 'term'
      ? { ...shared, type: 'term', context: value('context'), ...(origin ? { origin } : {}) }
      : { ...shared, type: 'meme', origin, media: { kind: 'video', url: value('videoUrl') } };
    try {
      const response = await fetch(apiUrl('/api/submissions'), {
        method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey }, body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('submission failed');
      setSubmissionState('sent');
    } catch {
      setSubmissionState('error');
    }
  };

  let previewUrl: string | null = null;
  if ((newType === 'meme' || editingMeme) && videoUrl) {
    try { previewUrl = parseExternalVideoUrl(videoUrl).embedUrl; } catch { previewUrl = null; }
  }

  if (editSlug && !card) return editMissing
    ? <section className="empty-state"><span>404</span><h1>Карточка не найдена</h1><p>Возможно, материал снят с публикации.</p><a className="button button--dark" href="#/memology">Вернуться в мемологию</a></section>
    : <section className="empty-state" aria-live="polite"><h1>Загружаем карточку…</h1></section>;

  if (!card) return (
    <section className="correction-page new-card-page">
      <h1>Добавить карточку</h1>
      <p className="correction-page__lead">Сначала выберите тип материала. Карточка появится на сайте только после проверки редакцией.</p>
      <section className="new-card-picker" aria-labelledby="new-card-picker-title">
        <h2 id="new-card-picker-title">Что добавляем?</h2>
        <div><button type="button" aria-pressed={newType === 'term'} onClick={() => { setNewType('term'); setSubmissionState('idle'); }}>Термин</button><button type="button" aria-pressed={newType === 'meme'} onClick={() => { setNewType('meme'); setSubmissionState('idle'); }}>Мем</button></div>
      </section>
      {newType && <form className="correction-form new-card-form" onSubmit={submitNew}>
        <label>Название<input name="title" required maxLength={80} /></label>
        <label className="correction-form__wide">{newType === 'term' ? 'Простое объяснение' : 'Объяснение смысла'}<textarea name="explanation" required maxLength={1500} rows={5} /></label>
        <label>{newType === 'term' ? 'Пример употребления' : 'Пример ситуации'}<textarea name="example" required maxLength={500} rows={4} /></label>
        {newType === 'term' ? <label>Контекст<textarea name="context" required maxLength={800} rows={4} /></label> : <label>Происхождение<textarea name="origin" required maxLength={1000} rows={4} /></label>}
        {newType === 'term' && <label className="correction-form__wide">Происхождение — необязательно<textarea name="origin" maxLength={1000} rows={3} /></label>}
        {newType === 'meme' && <label className="correction-form__wide">Ссылка на RuTube или YouTube<input name="videoUrl" type="url" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} required placeholder="https://rutube.ru/video/…" /></label>}
        {newType === 'meme' && videoUrl && (previewUrl ? <div className="new-card-preview"><iframe src={previewUrl} title="Превью видео мема" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div> : <p className="form-status form-status--error" role="alert">Поддерживаются только корректные HTTPS-ссылки RuTube и YouTube.</p>)}
        <label className="correction-form__wide">Теги через запятую<input name="tags" maxLength={240} placeholder="например: реакция, видео, ирония" /></label>
        <label>Автор карточки — необязательно<input name="author" maxLength={60} /></label>
        <div className="correction-form__actions"><button className="button button--dark" type="submit" disabled={submissionState === 'sending' || (newType === 'meme' && !previewUrl)}>{submissionState === 'sending' ? 'Отправляем…' : 'Отправить на модерацию'}</button><small>Не указывайте персональные данные.</small></div>
        {submissionState === 'sent' && <p className="form-status form-status--success" role="status">Карточка отправлена. Редакция проверит её перед публикацией.</p>}
        {submissionState === 'error' && <p className="form-status form-status--error" role="alert">Не получилось отправить. Данные остались в форме — попробуйте ещё раз.</p>}
      </form>}
    </section>
  );

  const submitCorrection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmissionState('sending');
    const values = new FormData(event.currentTarget);
    const author = String(values.get('author') ?? '').trim();
    const origin = String(values.get('origin') ?? '').trim();
    const shared = {
      title: String(values.get('title') ?? ''),
      explanation: String(values.get('explanation') ?? ''),
      example: String(values.get('example') ?? ''),
      tags: card.aliases?.slice(0, 8) ?? [],
      ...(author ? { author } : {}),
      correction: {
        targetSlug: cardSlug(card), changeNote: String(values.get('changeNote') ?? ''),
        original: {
          title: card.title, explanation: card.text, example: card.example,
          tags: card.aliases?.slice(0, 8) ?? [], ...(card.etymology ? { origin: card.etymology } : {}),
          ...(card.media ? { media: card.media } : {}),
        },
      },
    };
    const payload = editingMeme
      ? { ...shared, type: 'meme', origin, media: { kind: 'video', url: String(values.get('videoUrl') ?? '').trim() } }
      : { ...shared, type: 'term', context: String(values.get('context') ?? ''), ...(origin ? { origin } : {}), correction: { ...shared.correction, original: { ...shared.correction.original, context: cardContext(card) } } };
    try {
      const response = await fetch(apiUrl('/api/submissions'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': createIdempotencyKey() },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('submission failed');
      setSubmissionState('sent');
    } catch {
      setSubmissionState('error');
    }
  };

  return (
    <section className="correction-page">
      <a className="term-detail__back" href={`#/${card.type === 'Мемология' ? 'memology' : 'dictionary'}/${encodeURIComponent(cardSlug(card))}`}>← Назад к карточке</a>
      <p className="eyebrow"><span /> Без регистрации · после модерации</p>
      <h1>Предложить изменения</h1>
      <p className="correction-page__lead">Исправьте только то, что считаете неточным. Исходная версия не изменится до решения редактора.</p>
      <form className="correction-form" onSubmit={submitCorrection}>
        <label>{editingMeme ? 'Название мема' : 'Термин'}<input name="title" defaultValue={card.title} required maxLength={80} /></label>
        <label className="correction-form__wide">{editingMeme ? 'Объяснение смысла' : 'Объяснение'}<textarea name="explanation" defaultValue={card.text} required maxLength={1500} rows={5} /></label>
        <label>{editingMeme ? 'Пример ситуации' : 'Пример употребления'}<textarea name="example" defaultValue={card.example} required maxLength={500} rows={4} /></label>
        {!editingMeme && <label>Контекст<textarea name="context" defaultValue={cardContext(card)} required maxLength={800} rows={4} /></label>}
        <label className="correction-form__wide">Происхождение<textarea name="origin" defaultValue={card.etymology ?? 'Слово закрепилось в русскоязычной интернет-среде и постепенно перешло из переписки в устную речь.'} maxLength={1000} rows={4} /></label>
        {editingMeme && <label className="correction-form__wide">Ссылка на RuTube или YouTube<input name="videoUrl" type="url" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} required /></label>}
        {editingMeme && videoUrl && (previewUrl ? <div className="new-card-preview"><iframe src={previewUrl} title="Превью видео мема" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div> : <p className="form-status form-status--error" role="alert">Поддерживаются только корректные HTTPS-ссылки RuTube и YouTube.</p>)}
        <label className="correction-form__wide">Что вы изменили?<textarea name="changeNote" required maxLength={500} rows={3} placeholder="Например: уточнил происхождение и добавил более понятный пример" /></label>
        <label>Автор правки — необязательно<input name="author" maxLength={60} /></label>
        <div className="correction-form__actions"><button className="button button--dark" type="submit" disabled={submissionState === 'sending' || (editingMeme && !previewUrl)}>{submissionState === 'sending' ? 'Отправляем…' : 'Отправить на модерацию'}</button><small>Персональные данные указывать не нужно.</small></div>
        {submissionState === 'sent' && <p className="form-status form-status--success" role="status">Предложение отправлено. Редакция проверит изменения перед публикацией.</p>}
        {submissionState === 'error' && <p className="form-status form-status--error" role="alert">Не получилось отправить. Данные сохранены в форме — попробуйте ещё раз.</p>}
      </form>
    </section>
  );
}

function Suggest() {
  return <section className="suggest"><div><p className="suggest__label">На модерацию</p><h2>Интернет сказал новое?</h2><p>Отправь слово или мем. Регистрация не нужна — публикация появится после проверки редакцией.</p></div><a className="button button--light" href="#/submit">Добавить карточку</a></section>;
}

export function App() {
  const [locationHash, setLocationHash] = useState(window.location.hash);
  const route = currentRoute();
  const detailMatch = locationHash.match(/^#\/(?:dictionary|memology)\/([^?]+)/);
  const rawDetailSlug = detailMatch?.[1];
  const detailSlug = rawDetailSlug ? decodeURIComponent(rawDetailSlug) : null;
  const detailCard = detailSlug ? [...dictionaryCards, ...memeCards].find((card) => cardSlug(card) === detailSlug) : undefined;
  const adminDetailMatch = locationHash.match(/^#\/admin\/content\/([^?]+)/);
  const adminContentId = adminDetailMatch?.[1] ? decodeURIComponent(adminDetailMatch[1]) : null;

  useEffect(() => {
    const updateRoute = () => {
      setLocationHash(window.location.hash);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    window.addEventListener('hashchange', updateRoute);
    return () => window.removeEventListener('hashchange', updateRoute);
  }, []);

  return (
    <div className="site-shell">
      <Header route={route} />
      <main>{detailCard ? <TermDetail card={detailCard} /> : detailSlug ? <PublicTermDetail slug={detailSlug} /> : route === 'admin-login' ? <AdminLoginPage /> : adminContentId ? <AdminEditorPage id={adminContentId} /> : route === 'admin' ? <AdminQueuePage /> : route === 'dictionary' ? <DictionaryPage /> : route === 'memology' ? <MemologyPage /> : route === 'quiz' ? <QuizPage /> : route === 'submit' ? <SubmitPage /> : <HomePage />}</main>
      <footer><a className="brand brand--footer" href="#/"><span>SKUF</span><span>СКИЛС</span></a><p>Скуф сегодня, сигма завтра</p><small>© 2026 · Сделано командой <a href="https://babrbook.com" target="_blank" rel="noopener noreferrer">Бабрбук</a></small></footer>
    </div>
  );
}


