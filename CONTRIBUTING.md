# Contributing to Mutorials
## Getting Started
Once you clone this repository, you have a couple options:
- fix bugs
- implement new features

Reference [GitHub](https://github.com/The-Mu-Foundation/Mutorials/issues) to see what we need help with.

## Mutorials Code Conventions
These are to be followed all the time 😁.

### Indentation
- Indents shall be 4 spaces, no tabs.
    - [set this as your setting on vscode](https://stackoverflow.com/a/38556923)
    - on vim:
        - put the following in your `.vimrc`.
        ```
        filetype plugin indent on
        set tabstop-4
        set shiftwidth=4
        set expandtab
        ```
        - then run `:source %`

### Naming
#### Backend
- camelCase for everything; this includes but is not limited to file names, variables (including functions), routes, etc.
    - EXCEPTION: mongoose Schema declarations follow PascalCase
    - EXCEPTION: environment variables use GIANT_SNAKE_CASE
- All admin routes (get or post) should start with "/admin/"

#### Frontend
- JavaScript variables follow camelCase, similar to backend
- For variables, use const for variables that will not be changed and use let for variables that will be changed. Do not use var.
- Following Bootstrap conventions, kebab-case will be used for classes, ids, names, and all of the other HTML tags

#### General
- Make names representative, no shorthands unless it’s obvious; i.e. “authentication”=“auth” is ok, but “question”=“antsy” is not; gray areas such as “Question”=“Ques” should be renamed (i.e. use “Question”, not “Ques”)
- File and folder names should be representative and categorize things accordingly

### Comments
#### Backend
- In index.js, all comments should go inside functions; no floating comments
    - EXCEPTION: comments in ALL CAPS that describe either configuration or describe other large blocks of code.
- In helper files, put a comment on top of each function being exported to briefly detail what it does

#### Frontend
- All comments must be ejs comments (so that they aren’t rendered into the page)
- All .ejs files should have a comment at the top briefly detailing what the page does and what the arguments are

#### General
- Comments NEVER go on a line that already has code in it
    - EXCEPTION: when using mongoose functions such as findOneAndUpdate, it is ok to use /* */ inline comments
- Make comments succinct and ONLY about important code functionality; ex. “// connects to database” is ok, “// prints to console” is not
- If you don’t need the code, delete it, don’t comment it out.

### Optimization
- Minimize number of database calls (both read and write)
- Reuse code when possible (i.e. if a thing is done in multiple places, see if a function is possible)
- Make algorithms elegant if you see a better way to do the same task
- Split functions that are big; each function should only do 1 task

### Structure
- All “special variables” (i.e. constants to be initialized early) are declared at the top of the file, below any imports

#### Routing
- Organize routes by POST/public-GET/private-GET/admin-GET (with comments in all caps declaring each of these blocks; reference code)
- Routes should be in alphabetical order within these 4 categories

### JavaScript
DISCLAIMER: these are nitpicky things which we just want to standardize
- “else” goes on same line as the closing bracket
- Opening brackets go on same line as the while/if/for/declaration/try/etc. before it
- If callbacks or .then()’s contain more than 1 line, make the content of the function a new line and don’t try to jam the whole thing into 1 line
- All indents should be 4 spaces, and indent correctly and reasonably
- .then() goes on the same line, not the next
- On frontend, prefer "double quotes". On backend, prefer 'single quotes'.

One last thing: if you’re refactoring a lot of code, remember to let the rest of the team know so that we can accommodate and avoid conflicts!

Ved Thiru (PerpetualCreativity on GitHub, vulcan#0604 on Discord)

Michael Li (ML72 on GitHub, ML72#2092 on Discord)

Ethan Shen (Skipppyyy on GitHub, Skippy#0700 on Discord)
