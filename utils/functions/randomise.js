module.exports = {
    generate: (question, type, choices, answer, answer_ex) => {
        // TODO: update user with question's answer
        // TODO: sin, cos, tan support

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
        var generatedNumbers = [];
        const numbers = question.matchAll(/&([a-z])=\((\d*), (\d*), (\d+?)\)&/g);
        for (let number of numbers) {
            generatedNumbers.push({ name: number[0], value: Number.parseFloat(Math.random()*(number[2]-number[1])+number[1]).toPrecision(number[3]) });
        }
        generatedNumbers.forEach(number => {
            question = question.replace(RegExp("&("+number.name+")=\((\d*), (\d*), (\d+?)\)&", 'g'), number.value);
            evalPrefix = evalPrefix + "let " + number.name + " = " + number.value + "; ";
        });
        question = [question]; answer = [answer]; answer_ex = [answer_ex];
        [question, choices].forEach(part => {
            part.forEach(text => {
                const evalBlocks = text.matchAll(/&&\[(.+?), (\d+)\]&&/g);
                for (let evalBlock of evalBlocks) {
                    if (/^[a-z0-9\^\+\/\*\(\)]+$/.test(evalBlock[0]) && /^( *\w *\W *)+\w *$/.test(evalBlock[0].replace(/(\(|\))/g, "") )) {
                        text = text.replace(evalBlock, Number.parseFloat(eval(evalPrefix + evalBlock)).toPrecision(evalBlock[1]));
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
};
