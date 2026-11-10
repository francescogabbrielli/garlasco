NEXT
----
- configure client ErrorHandler and backend Lambda -> CloudWatch
- review layout & CSS
- review routing guards when the user role is not synced
- implement notification system
- turn some bots into agents that can alter data
- add reason field in registration

TODO: 0.2.0
-----------
- create Hypothesis backend 
    - mermaid docs &check;
    - models &check;
- add edit capability for Persons &check;
- design a minimal 'Dashboard di Analisi' ...
- add import/export for new data
- save user preferences in user service &check;
- create dark theme & link to system theme &check;
- tune dark theme:
    - maps+places &check;
    - authenticator (maybe next) &cross;
    - website (event list, main menu, etc) &check;
- restructure filters:
    - move title and activation to parent component
    - map: make it usable as "view only"
    - timeline-slider: check colors (Material setup and dark theme compatibility)
- splash message &check;
- restructure Admin Dashboard, with users management &check;

TODO: 0.1.5
-----------
- fix bug token scaduti &check;
- fix bug caricamento persone nell'evento (LazyLoad) &check;

TODO: 0.1.4
-----------
- add version history &check;
- fix & generalise esc key precedence &check;
- AI usage:
    - set rate limits &cross; (maybe next)
    - manage remote errors &check; (needs improvements)
    - truncate output (time & length) &check;
- improve mail templates and mailing backend &check;
- review and stabilize code &check;
- make startPosition required only for type='Fatto' &check;
- show total events in info &check;

TODO: 0.1.3
-----------
- fix maps scrolling on mobile &check;
- add timeline scrolling on mobile &check;
- add search address in map-picker &check;
- reload persons after person creation &check;
- check mail settings for replies &check;

TODO: 0.1.2
-----------
- check CSS alignment for context-buttons (especially close and 
    actions-panel). Uniform all CSS &check;
- review registration & emails &check;

TODO: 0.1.1
-----------
- fix editing bug for event owner &check;
- add source links to event mask &check;
- link events together (maybe next) &cross;

TODO: 0.1.0
-----------
- trash home section altogether &check;
- Persons, MapPicker: unify all popups style and behaviour (almost there) &check;
- Event mask: 
    - add position remove button &check;
    - manage form modified status (also in Person mask) &check;
- Person filter: improve person selection (add type multichoice; show selected people) &check;
- Event list: 
    - group events by date (suppress hour), keeping facts as preminent &check;
    - show relevance for all &check;
    - show map preview in non edit mode &check;
- Import: add delete all data button (active after full download) &check;
- add confirm popups instead of plain javascript (use &lt;dialog&gt;?) &cross; (maybe next)
- Login and roles management:
    - add privacy policy in about and authenticator &check;
    - add default landing page for users with no role and request role "Member" for all other pages &check;
    - contact form & mail (espcially for requesting a role) in main menu &check;
    - review routes &check;
- Backend:
    - create sendMail and trigger functions &check;
    - improve AI generation (give DB access) &cross; (maybe next)
    - improve resource: add sources and related events to Event &check;
    - log changes and send by mail &cross; (maybe next)
- add chat with AI bots &check;


TODO: 0.0.6
-----------
- make time/map filter optional (or advanced search tools) &check;
- check map filter interference on results &check;
- check & improve more events loading &check;
- add loading for help files and AI hints &check;
- popup should display over topbar &check;
- minor backend fixes &check;

TODO: 0.0.5
-----------
- fix topbar glitches & layout / show more text if there is room &check;
- fix glitches in the autocomplete &check;
- check export / import consistency &check;
- make time/map filter optional? &cross; (done in 0.0.6)
- add AI hints &check;
- still user displays error after delayed login &check;

TODO: 0.0.4
-----------
- change help files to txt &check;

TODO: 0.0.3
-----------
- fix timeline glitch on slider drag &check;
- fix filters persistence &check;
- fix user details not showing on delayed login &check;
- add export secton &check;
- unify buttons & action panels CSS &check;
- setup new home & about details &check;
- add more help sections (create ad hoc popup?) &check;
