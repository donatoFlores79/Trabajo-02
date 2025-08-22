// Configuración base
    const GAME_W = 800;
    const GAME_H = 600;

    class MainScene extends Phaser.Scene {
      constructor() {
        super('main');
        this.score = 0;
        this.timeLeft = 30; // segundos por partida
        this.isRunning = false;
        this.moleAlive = false;
        this.moleDuration = 900; // ms, disminuirá con el tiempo
        this.grid = [];
        this.holes = [];
        this.activeHoleIndex = -1;
      }

      preload() {
        // Genera texturas simples (sin imágenes externas)
        const g = this.make.graphics({ x: 0, y: 0, add: false });

        g.fillStyle(0x3e2723, 1); // marrón muy oscuro
        g.fillEllipse(40, 20, 80, 40);
        g.fillStyle(0x4e342e, 1);
        g.fillEllipse(40, 22, 80, 40);
        g.fillStyle(0x5d4037, 1);
        g.fillEllipse(40, 24, 80, 40);
        g.generateTexture('hole', 80, 48);
        g.clear();

        // Topo (cuerpo)
        g.fillStyle(0x8b5e3c, 1);
        g.fillCircle(32, 32, 30);
        // Hocico
        g.fillStyle(0xd1a074, 1);
        g.fillCircle(32, 40, 12);
        // Ojos
        g.fillStyle(0x000000, 1);
        g.fillCircle(22, 28, 4);
        g.fillCircle(42, 28, 4);
        // Dientes
        g.fillStyle(0xffffff, 1);
        g.fillRect(28, 48, 8, 8);
        g.generateTexture('mole', 64, 64);
        g.clear();

        // Partícula de golpe
        g.fillStyle(0xfff3c4, 1);
        for (let i = 0; i < 10; i++) g.fillCircle(16 + Math.random()*16, 16 + Math.random()*16, 3 + Math.random()*2);
        g.generateTexture('spark', 48, 48);
        g.clear();
      }

      create() {
        const { width, height } = this.scale;

        // Crear fondo simple
        this.add.rectangle(width/2, height/2, width, height, 0x0b1220).setAlpha(0.5);

        // Crear una cuadrícula de 3x3 para los agujeros
        const cols = 3, rows = 3;
        const spacingX = 220, spacingY = 150;
        const startX = width/2 - spacingX;
        const startY = 180;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const x = startX + c * spacingX;
            const y = startY + r * spacingY;
            // Agujero (siempre visible)
            const hole = this.add.image(x, y + 30, 'hole').setDepth(0);
            // Topo (aparece/desaparece)
            const mole = this.add.image(x, y, 'mole')
              .setScale(0.001) // arranca oculto
              .setVisible(false)
              .setInteractive({ useHandCursor: true })
              .setDepth(1);

            mole.on('pointerdown', (pointer) => {
              if (!this.isRunning || !this.moleAlive) return;
              if (this.grid[this.activeHoleIndex] !== mole) return; // solo el activo
              this.whack(mole);
            });

            this.grid.push(mole);
            this.holes.push(hole);
          }
        }

        // Texto HUD
        this.scoreText = this.add.text(20, 20, 'Puntos: 0', { fontSize: '28px', fontFamily: 'monospace', color: '#e2e8f0' });
        this.timeText = this.add.text(width - 20, 20, 'Tiempo: 30', { fontSize: '28px', fontFamily: 'monospace', color: '#e2e8f0' }).setOrigin(1, 0);
        this.msgText = this.add.text(width/2, 72, 'Haz clic para empezar', { fontSize: '32px', fontFamily: 'monospace', color: '#fde68a' }).setOrigin(0.5);

        // Efecto de partículas para golpes
        this.particles = this.add.particles(0, 0, 'spark', { 
          speed: { min: 80, max: 200 },
          scale: { start: 1, end: 0 },
          lifespan: 400,
          quantity: 8,
          emitting: false
        });

        // Iniciar con clic en cualquier parte del canvas
        this.input.once('pointerdown', () => this.startGame());

        // Reinicio desde el botón externo
        document.getElementById('restartBtn').addEventListener('click', () => {
          this.scene.restart();
        });
      }

      startGame() {
        this.isRunning = true;
        this.score = 0;
        this.timeLeft = 30;
        this.moleDuration = 900;
        this.msgText.setText('¡A jugar!');
        this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tick() });
        this.spawnLoop = this.time.addEvent({ delay: 600, loop: true, callback: () => this.spawnMole() });
      }

      tick() {
        if (!this.isRunning) return;
        this.timeLeft -= 1;
        this.timeText.setText('Tiempo: ' + this.timeLeft);

        // Aumenta dificultad cada 6s (mole aparece menos tiempo)
        if (this.timeLeft % 6 === 0 && this.moleDuration > 350) {
          this.moleDuration -= 100;
        }

        if (this.timeLeft <= 0) this.gameOver();
      }

      spawnMole() {
        if (!this.isRunning || this.moleAlive) return;
        const idx = Phaser.Math.Between(0, this.grid.length - 1);
        this.activeHoleIndex = idx;
        const mole = this.grid[idx];
        mole.setVisible(true).setScale(0.001);
        this.moleAlive = true;

        // Animación de salida (pop)
        this.tweens.add({
          targets: mole,
          scale: 1,
          duration: 120,
          ease: 'Back.Out'
        });

        // Si no lo golpeas a tiempo, se esconde
        this.time.delayedCall(this.moleDuration, () => {
          if (!this.moleAlive) return; // ya fue golpeado
          this.hideMole(mole);
        });
      }

      hideMole(mole) {
        this.moleAlive = false;
        this.activeHoleIndex = -1;
        this.tweens.add({
          targets: mole,
          scale: 0.001,
          duration: 120,
          ease: 'Back.In',
          onComplete: () => mole.setVisible(false)
        });
      }

      whack(mole) {
        // +1 punto y efecto
        this.score += 1;
        this.scoreText.setText('Puntos: ' + this.score);
        this.particles.emitParticleAt(mole.x, mole.y - 10, 10);

        // pequeño flash del topo
        this.tweens.add({ targets: mole, angle: Phaser.Math.Between(-10, 10), y: mole.y - 6, yoyo: true, duration: 80 });

        // Ocultar el topo
        this.hideMole(mole);
      }

      gameOver() {
        this.isRunning = false;
        this.msgText.setText('¡Fin! Puntos: ' + this.score);
        if (this.spawnLoop) this.spawnLoop.remove(false);
        // Mostrar botón de reinicio
        document.getElementById('restartBtn').style.display = 'inline-block';
      }
    }

    const config = {
      type: Phaser.AUTO,
      parent: 'game',
      width: GAME_W,
      height: GAME_H,
      backgroundColor: '#154d1d',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      scene: [MainScene]
    };

    new Phaser.Game(config);