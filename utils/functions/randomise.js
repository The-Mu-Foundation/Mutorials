function generate(question, type, choices, answer, answer_ex) {
    // TODO: update user with question's answer
    // TODO: sig fig support

    /// INPUT:
    /// question:  string
    /// type:      string, must be either (mc, sa, or fr)
    /// choices:   string if fr, else array
    /// answer:    string
    /// answer_ex: string
    /// OUTPUT:
    /// object:
        /// .question:  string
        /// .choices:   string if fr, else array
        /// .answer:    string
        /// .answer_ex: string

    if (type == "fr") {
        choices = [choices];
    }
    var evalPrefix = "";
    // parse question for numbers
    var generatedNumbers = [];
    const numbers = question.matchAll(/&([a-z])=\((\d*), (\d*), (\d+?|c)\)&/g);
    for (let number of numbers) {
        generatedNumbers.push({ name: number[0], value: Math.random() * (number[2]-number[1]) + number[1] });
    }
    // replace question with generated numbers
    generatedNumbers.forEach(number => {
        // replace question with generated numbers
        question = question.replace(RegExp("&("+number.name+")=\((\d*), (\d*), (\d+?|c)\)&", 'g'), number.value);
        // generate eval string prefix (use of "let" prevents `eval` from polluting namespace)
        evalPrefix = evalPrefix + "let " + number.name + " = " + number.value + "; ";
    });
    // parse question and choices to parse evaluation blocks
    question = [question]; answer = [answer]; answer_ex = [answer_ex];
    [question, choices].forEach(part => {
        part.forEach(text => {
            const evalBlocks = text.matchAll(/&&(.+?)&&/g);
            for (let evalBlock of evalBlocks) {
                if (/^[a-z\^\+\/\*\(\)]+$/.test(evalBlock[0]) && /^( *\w *\W *)+\w *$/.test(evalBlock[0])) {
                    text = text.replace(evalBlock, eval(evalPrefix + evalBlock));
                }
            }
        });
    });
    return {
        question: question[0],
        choices: (type=="fr" ? choices[0] : choices),
        answer: answer[0],
        answer_ex: answer_ex[0]
    };
}
